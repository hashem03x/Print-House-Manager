import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function normalizeError(err) {
  if (err instanceof ApiError) return err;

  // Malformed JSON body or oversized payload (raised by express.json)
  if (err.type === 'entity.parse.failed') {
    return ApiError.badRequest('Request body contains invalid JSON', undefined, 'INVALID_JSON');
  }
  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'Request body is too large', undefined, 'PAYLOAD_TOO_LARGE');
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([field, detail]) => [field, detail.message])
    );
    return ApiError.badRequest('Validation failed', errors);
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for "${err.path}"`, { [err.path]: err.message }, 'INVALID_VALUE');
  }

  // Connection lost between the requireDb check and the query
  if (
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNotConnectedError'
  ) {
    return ApiError.serviceUnavailable('Database is not reachable. Please try again shortly.');
  }

  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const apiError = normalizeError(err);

  if (!apiError) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      // Expose details only during development; never in production.
      errors: env.isProduction ? undefined : { detail: err.message },
    });
  }

  if (apiError.statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}: ${apiError.message}`);
  }

  res.status(apiError.statusCode).json({
    success: false,
    message: apiError.message,
    code: apiError.code,
    errors: apiError.errors,
  });
}
