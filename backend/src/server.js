// Entry point for persistent hosting (local dev, Render, Railway, VPS…).
// Serverless platforms such as Vercel import src/app.js directly instead; there
// the database connection is opened lazily by the requireDb middleware.
import { env } from './config/env.js';
import { connectWithRetry, disconnectDB } from './config/db.js';
import app from './app.js';

async function start() {
  if (env.configErrors.length > 0) {
    for (const message of env.configErrors) console.error(`[config] ${message}`);
    if (!env.mongodbUri) process.exit(1);
  }

  // Accept requests only once MongoDB is reachable (with a few retries).
  try {
    await connectWithRetry();
  } catch (error) {
    console.error(`[db] Giving up: ${error.message}`);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.info(`[server] API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[server] Port ${env.port} is already in use. Set a different PORT in backend/.env.`);
    } else {
      console.error('[server] Failed to start:', error);
    }
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.info(`[server] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
