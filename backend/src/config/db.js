import mongoose from 'mongoose';
import { env } from './env.js';

// Fail fast instead of silently queueing queries while the database is down.
mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);

const STATE_NAMES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
// After a failed attempt, further requests fail fast for this long instead of
// each waiting for a new connection timeout.
const RETRY_COOLDOWN_MS = 5000;
// How long a request waits for the driver to re-establish a dropped connection.
const RECONNECT_WAIT_MS = 3000;

/**
 * Connection state shared by everything that imports this module, stored on
 * globalThis so it survives dev hot reloads and is reused across warm
 * serverless invocations. One mongoose connection (the default one, which the
 * models use) is opened per process — never one per request.
 */
const cache = (globalThis.__printHouseMongo ??= {
  promise: null, // in-flight or completed initial connection
  everConnected: false, // after the first success the driver reconnects by itself
  lastError: null, // { category, at } of the last failure (sanitized)
  listenersAttached: false,
});

export class DbConnectionError extends Error {
  constructor(category, message, cause) {
    super(message, { cause });
    this.name = 'DbConnectionError';
    this.category = category;
  }
}

/** mongodb+srv://user:secret@host/db -> mongodb+srv://***@host/db (safe to log). */
export function redactUri(uri) {
  return String(uri).replace(/\/\/[^@/]+@/, '//***@');
}

export function getDbState() {
  return STATE_NAMES[mongoose.connection.readyState] ?? 'unknown';
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export function getLastDbError() {
  return cache.lastError;
}

/**
 * Classifies a connection error into a sanitized category that can be logged
 * and shown in /api/health without leaking credentials or hostnames.
 */
export function categorizeDbError(error) {
  if (error instanceof DbConnectionError) return error.category;
  const text = `${error?.name ?? ''} ${error?.code ?? ''} ${error?.codeName ?? ''} ${error?.message ?? ''} ${
    error?.cause?.message ?? ''
  }`;
  if (/MongoParseError|Invalid scheme|URI malformed|must be URL encoded|Password contains unescaped/i.test(text)) {
    return 'invalid_uri';
  }
  // 18 = AuthenticationFailed (MongoDB), 8000 = Atlas "bad auth".
  const authCodes = [18, 8000];
  if (authCodes.includes(error?.code) || authCodes.includes(error?.cause?.code) || /bad auth|Authentication failed|SCRAM/i.test(text)) {
    return 'authentication_failed';
  }
  if (/ENOTFOUND|querySrv|EAI_AGAIN|getaddrinfo/i.test(text)) return 'dns_resolution_failed';
  if (/whitelist|not whitelisted|IP address|access list/i.test(text)) return 'network_access_denied';
  if (/ECONNREFUSED/i.test(text)) return 'connection_refused';
  if (/ETIMEDOUT|timed out|Server selection timed out|MongoServerSelectionError/i.test(text)) return 'timeout';
  return 'unknown';
}

const CATEGORY_HINTS = {
  missing_configuration: 'Set MONGODB_URI in the environment (hosting platform settings) and redeploy.',
  invalid_uri: 'Check the MONGODB_URI format; URL-encode special characters in the password.',
  authentication_failed: 'Check the database username/password in MONGODB_URI and the user’s permissions.',
  dns_resolution_failed: 'Check the cluster hostname in MONGODB_URI.',
  network_access_denied: 'Allow the server’s IP addresses in MongoDB Atlas → Network Access.',
  connection_refused: 'Check that MongoDB is running and reachable at the configured host/port.',
  timeout:
    'Could not reach any MongoDB server in time. For Atlas this usually means Network Access does not allow this server’s IP.',
  connection_lost: 'The connection dropped; the driver is reconnecting.',
  unknown: 'See the server logs for details.',
};

function logDbFailure(category, error) {
  const detail = error?.message ? redactUri(error.message) : '';
  console.error(
    `[db] MongoDB connection failed (${category}). ${CATEGORY_HINTS[category] ?? ''}${detail ? `\n     Detail: ${detail}` : ''}`
  );
}

function attachListeners() {
  if (cache.listenersAttached) return;
  cache.listenersAttached = true;
  const { connection } = mongoose;
  connection.on('disconnected', () => {
    if (cache.everConnected) console.warn('[db] MongoDB disconnected; the driver will try to reconnect');
  });
  connection.on('reconnected', () => console.info('[db] MongoDB reconnected'));
  connection.on('error', (error) => console.error(`[db] MongoDB error (${categorizeDbError(error)}): ${redactUri(error.message)}`));
}

/**
 * Opens the shared connection once. Concurrent callers share the same
 * in-flight promise; a failed attempt is forgotten so a later call can retry.
 */
export function connectDB(uri = env.mongodbUri, { timeoutMs = env.dbConnectTimeoutMs } = {}) {
  if (isDbConnected()) return Promise.resolve(mongoose.connection);
  if (cache.promise) return cache.promise;

  if (!uri) {
    const error = new DbConnectionError('missing_configuration', 'MONGODB_URI is not configured');
    cache.lastError = { category: error.category, at: new Date().toISOString() };
    logDbFailure(error.category);
    return Promise.reject(error);
  }

  attachListeners();
  cache.promise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: timeoutMs,
      // Small pool: serverless instances are many and short-lived.
      maxPoolSize: env.isServerless ? 5 : 10,
    })
    .then(() => {
      cache.everConnected = true;
      cache.lastError = null;
      const { host, name } = mongoose.connection;
      console.info(`[db] Connected to MongoDB at ${host} (database: "${name}")`);
      return mongoose.connection;
    })
    .catch((error) => {
      const category = categorizeDbError(error);
      cache.promise = null;
      cache.lastError = { category, at: new Date().toISOString() };
      logDbFailure(category, error);
      throw new DbConnectionError(category, `Could not connect to MongoDB at ${redactUri(uri)} (${category})`, error);
    });

  return cache.promise;
}

function waitForReconnect(timeoutMs) {
  const { connection } = mongoose;
  return new Promise((resolve, reject) => {
    const done = (ok) => {
      clearTimeout(timer);
      connection.off('connected', onConnected);
      connection.off('reconnected', onConnected);
      if (ok) resolve();
      else reject(new DbConnectionError('connection_lost', 'Database connection lost; reconnecting'));
    };
    const onConnected = () => done(true);
    const timer = setTimeout(() => done(isDbConnected()), timeoutMs);
    connection.on('connected', onConnected);
    connection.on('reconnected', onConnected);
  });
}

/**
 * Resolves when the database is ready to serve a request, opening the shared
 * connection on first use. Used by request handlers so the app works both as a
 * persistent server and as a serverless function (where server.js never runs).
 * Rejects with DbConnectionError (bounded by the connect timeout).
 */
export async function ensureDbConnection() {
  if (isDbConnected()) return;

  // Connected before: the driver is already reconnecting — wait briefly, never reconnect manually.
  if (cache.everConnected) {
    await waitForReconnect(RECONNECT_WAIT_MS);
    return;
  }

  // Recent failure: fail fast rather than making every request wait for a new timeout.
  const last = cache.lastError;
  if (!cache.promise && last && Date.now() - Date.parse(last.at) < RETRY_COOLDOWN_MS) {
    throw new DbConnectionError(last.category, `Database unavailable (${last.category})`);
  }

  await connectDB();
}

/**
 * Initial connection for the persistent server: a few attempts with backoff,
 * then gives up so the process manager can restart it.
 */
export async function connectWithRetry({ attempts = 5, baseDelayMs = 1000 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await connectDB();
    } catch (error) {
      if (attempt === attempts || error.category === 'missing_configuration' || error.category === 'invalid_uri') {
        throw error;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(`[db] Attempt ${attempt}/${attempts} failed (${error.category}); retrying in ${delay / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return undefined;
}

export async function disconnectDB() {
  await mongoose.connection.close();
  cache.promise = null;
  cache.everConnected = false;
}
