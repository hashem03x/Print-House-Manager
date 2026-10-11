import { isDbConnected } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

// Returns a clear 503 instead of a timeout when MongoDB is unreachable.
export function requireDb(_req, _res, next) {
  if (!isDbConnected()) {
    return next(ApiError.serviceUnavailable('Database is not connected. Please try again shortly.'));
  }
  next();
}
