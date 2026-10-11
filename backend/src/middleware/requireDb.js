import { ensureDbConnection, getDbState } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Makes sure the shared MongoDB connection is ready before a route touches the
 * database, opening it on first use (required on serverless hosts, where
 * server.js never runs). Responds 503 DB_UNAVAILABLE only when connecting
 * actually fails; the client never sees credentials or hostnames.
 */
export async function requireDb(req, _res, next) {
  try {
    await ensureDbConnection();
    next();
  } catch (error) {
    console.error(
      `[db] ${req.method} ${req.originalUrl} rejected: database ${getDbState()} (${error.category ?? 'unknown'})`
    );
    next(ApiError.serviceUnavailable('Database is not connected. Please try again shortly.'));
  }
}
