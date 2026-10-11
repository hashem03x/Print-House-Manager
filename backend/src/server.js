import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import app from './app.js';

async function start() {
  try {
    await connectDB(env.mongodbUri);
  } catch (error) {
    console.error(`[db] ${error.message}`);
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
