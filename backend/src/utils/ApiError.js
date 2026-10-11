/**
 * Error with an HTTP status and a stable machine-readable `code`, so clients can
 * tell apart cases that share a status (e.g. TASK_NOT_FOUND vs ROUTE_NOT_FOUND).
 */
export class ApiError extends Error {
  constructor(statusCode, message, errors, code) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
  }

  static badRequest(message = 'Invalid request', errors, code = 'VALIDATION_ERROR') {
    return new ApiError(400, message, errors, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, message, undefined, code);
  }

  static serviceUnavailable(message = 'Service unavailable') {
    return new ApiError(503, message, undefined, 'DB_UNAVAILABLE');
  }
}
