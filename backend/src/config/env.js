import dotenv from 'dotenv';
import { isValidTimeZone } from '../utils/dates.js';

dotenv.config({ quiet: true });

function fail(message) {
  console.error(`[config] ${message}`);
  process.exit(1);
}

const required = ['MONGODB_URI'];
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  fail(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      '         Copy backend/.env.example to backend/.env and fill in the values.'
  );
}

const timeZone = process.env.APP_TIMEZONE?.trim() || 'UTC';
if (!isValidTimeZone(timeZone)) {
  fail(`APP_TIMEZONE "${timeZone}" is not a valid IANA time zone (e.g. Africa/Cairo, Europe/London, UTC).`);
}

const port = Number.parseInt(process.env.PORT, 10);

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number.isInteger(port) && port > 0 ? port : 5000,
  mongodbUri: process.env.MONGODB_URI.trim(),
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  // Business time zone used to decide what "today" means for statistics.
  timeZone,
});
