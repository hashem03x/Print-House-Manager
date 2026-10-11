/**
 * True only when the API says the task itself does not exist. A 404 for an
 * unknown route (e.g. an outdated API server without that endpoint) is NOT a
 * deleted task and must not be reported as one.
 */
export function isTaskNotFound(error) {
  return error?.name === 'ApiError' && error.status === 404 && error.code === 'TASK_NOT_FOUND';
}

/** Maps an ApiError (or anything thrown) to a translation key for display. */
export function getErrorMessageKey(error) {
  if (error?.name !== 'ApiError') return 'errors.generic';
  if (error.kind === 'network') return 'errors.network';
  if (error.kind === 'timeout') return 'errors.timeout';
  if (error.status === 503) return 'errors.dbUnavailable';
  if (isTaskNotFound(error)) return 'errors.notFound';
  if (error.status === 404 || error.status === 405) return 'errors.unsupported';
  if (error.status === 400) return 'errors.validation';
  if (error.status >= 500) return 'errors.server';
  return 'errors.generic';
}
