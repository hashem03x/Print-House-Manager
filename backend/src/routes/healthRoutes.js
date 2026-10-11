import { Router } from 'express';
import { ensureDbConnection, getDbState, getLastDbError, isDbConnected } from '../config/db.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * GET /api/health
 * - 200 when the API and the database are both ready.
 * - 503 when the API is up but the database is not ("degraded").
 * Opens the connection if needed (bounded by DB_CONNECT_TIMEOUT_MS), so on a
 * cold serverless instance it reports real readiness, not "not tried yet".
 * `databaseReason` is a sanitized category (e.g. authentication_failed,
 * network_access_denied, timeout) — never a connection string or hostname.
 */
router.get('/', async (_req, res) => {
  let reason = null;
  try {
    await ensureDbConnection();
  } catch (error) {
    reason = error.category ?? 'unknown';
  }

  const ready = isDbConnected();
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? 'ok' : 'degraded',
      api: 'up',
      database: getDbState(),
      databaseReason: ready ? null : reason ?? getLastDbError()?.category ?? 'unknown',
      configurationValid: env.configErrors.length === 0,
      runtime: env.isServerless ? 'serverless' : 'server',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    message: ready ? 'API is healthy' : 'API is running but the database is not connected',
  });
});

export default router;
