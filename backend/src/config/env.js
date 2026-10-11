import dotenv from 'dotenv';
import { isValidTimeZone } from '../utils/dates.js';

// Loads backend/.env locally. On hosting platforms (Vercel, Render, …) the
// variables come from the platform's settings; dotenv never overrides them.
dotenv.config({ quiet: true });

/**
 * Configuration problems are collected instead of exiting the process: a
 * serverless function must stay alive to answer with a clear 503, while the
 * persistent server (server.js) refuses to start when this list is not empty.
 */
const configErrors = [];

const mongodbUri = process.env.MONGODB_URI?.trim() ?? '';
if (!mongodbUri) {
  configErrors.push(
    'MONGODB_URI is not set. Locally: copy backend/.env.example to backend/.env. ' +
      'In production: add it to the hosting platform environment variables and redeploy.'
  );
} else if (!/^mongodb(\+srv)?:\/\//.test(mongodbUri)) {
  configErrors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
}

let timeZone = process.env.APP_TIMEZONE?.trim() || 'UTC';
if (!isValidTimeZone(timeZone)) {
  configErrors.push(`APP_TIMEZONE "${timeZone}" is not a valid IANA time zone; falling back to UTC.`);
  timeZone = 'UTC';
}

const port = Number.parseInt(process.env.PORT, 10);
const connectTimeout = Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10);

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  // Vercel sets VERCEL=1 at runtime; connections are then opened lazily per instance.
  isServerless: Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY),
  port: Number.isInteger(port) && port > 0 ? port : 5000,
  mongodbUri,
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  // Business time zone used to decide what "today" means for statistics.
  timeZone,
  // How long one connection attempt may take. Kept well below serverless
  // function time limits so requests fail with a 503 instead of timing out.
  dbConnectTimeoutMs: Number.isInteger(connectTimeout) && connectTimeout > 0 ? connectTimeout : 7000,
  configErrors: Object.freeze(configErrors),
});
