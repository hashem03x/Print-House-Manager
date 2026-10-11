import { apiRequest } from './apiClient.js';

/**
 * @param {{ page?: number, limit?: number, search?: string, paperType?: string,
 *           paperSize?: string, sortBy?: string, order?: 'asc' | 'desc' }} params
 * @returns {Promise<{ tasks: object[], pagination: object }>}
 */
export function listTasks(params, { signal } = {}) {
  return apiRequest('/tasks', { query: params, signal });
}

export function getTask(id, { signal } = {}) {
  return apiRequest(`/tasks/${encodeURIComponent(id)}`, { signal });
}

/** @returns {Promise<{ totalTasks, tasksToday, totalValue, latestTasks, timeZone, todayStart }>} */
export function getTaskStats({ signal } = {}) {
  return apiRequest('/tasks/stats', { signal });
}

export function createTask(task) {
  return apiRequest('/tasks', { method: 'POST', body: task });
}

export function updateTask(id, changes) {
  return apiRequest(`/tasks/${encodeURIComponent(id)}`, { method: 'PUT', body: changes });
}

/** @param {'pending' | 'completed'} status */
export function updateTaskStatus(id, status) {
  return apiRequest(`/tasks/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
}

export function deleteTask(id) {
  return apiRequest(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
