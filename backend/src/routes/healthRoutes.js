import { Router } from 'express';
import { isDbConnected } from '../config/db.js';

const router = Router();

// GET /api/health — 200 when the API and database are up, 503 otherwise.
router.get('/', (_req, res) => {
  const dbConnected = isDbConnected();

  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    data: {
      status: dbConnected ? 'ok' : 'degraded',
      database: dbConnected ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    message: dbConnected ? 'API is healthy' : 'API is running but the database is not connected',
  });
});

export default router;
