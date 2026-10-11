// Base URL: VITE_API_URL in production, otherwise "/api" (proxied to the backend by Vite in dev).
const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  /**
   * @param {string} message Server message (English, for logs only — the UI shows translated text).
   * @param {{ status?: number, kind?: 'http' | 'network' | 'timeout', errors?: Record<string, string>, code?: string }} details
   *   `code` is the API's machine-readable error code (e.g. TASK_NOT_FOUND, ROUTE_NOT_FOUND).
   */
  constructor(message, { status = 0, kind = 'http', errors, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    this.errors = errors;
    this.code = code;
  }
}

function combineSignals(signal, timeoutSignal) {
  if (!signal) return timeoutSignal;
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([signal, timeoutSignal]);
  return signal;
}

/**
 * Sends a JSON request and returns the `data` field of a successful response.
 * Throws ApiError for HTTP, network and timeout failures. Caller aborts are rethrown as-is.
 */
export async function apiRequest(path, { method = 'GET', query, body, signal } = {}) {
  const url = new URL(API_URL + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combineSignals(signal, timeoutSignal),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeoutSignal.aborted) throw new ApiError('Request timed out', { kind: 'timeout' });
    throw new ApiError('Network error', { kind: 'network' });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response (e.g. proxy error page) — handled below.
  }

  // A non-JSON error (proxy/gateway page) means the API itself could not be reached.
  if (!payload && !response.ok) {
    throw new ApiError(`API unreachable (status ${response.status})`, { status: response.status, kind: 'network' });
  }
  if (!response.ok || !payload?.success) {
    throw new ApiError(payload?.message || `Request failed with status ${response.status}`, {
      status: response.status,
      errors: payload?.errors,
      code: payload?.code,
    });
  }
  return payload.data;
}

export function isAbortError(error) {
  return error?.name === 'AbortError';
}
