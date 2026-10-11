import { useCallback, useRef, useState } from 'react';
import { updateTaskStatus } from '../../services/taskApi.js';
import { getErrorMessageKey, isTaskNotFound } from '../../utils/apiErrors.js';
import { useToast } from '../common/Toast/useToast.js';

/**
 * Toggles a task between pending and completed via PATCH /api/tasks/:id/status.
 * Ignores repeated clicks for a task while its request is in flight.
 *
 * @param onUpdated (updatedTask) => void — called with the server's response.
 * @param onMissing () => void — called if the task no longer exists.
 * @returns {{ toggle: (task) => Promise<void>, isUpdating: (id) => boolean }}
 */
export function useTaskStatusToggle({ onUpdated, onMissing } = {}) {
  const toast = useToast();
  const inFlight = useRef(new Set());
  const [updatingIds, setUpdatingIds] = useState(() => new Set());
  const callbacks = useRef({ onUpdated, onMissing });
  callbacks.current = { onUpdated, onMissing };

  const toggle = useCallback(
    async (task) => {
      if (inFlight.current.has(task.id)) return;
      inFlight.current.add(task.id);
      setUpdatingIds(new Set(inFlight.current));

      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      try {
        const updated = await updateTaskStatus(task.id, nextStatus);
        toast.success(nextStatus === 'completed' ? 'toast.markedCompleted' : 'toast.markedPending');
        callbacks.current.onUpdated?.(updated);
      } catch (error) {
        if (isTaskNotFound(error)) {
          toast.info('toast.alreadyDeleted');
          callbacks.current.onMissing?.();
        } else {
          // Say why it failed (network, database, outdated API…), not just that it did.
          toast.error('toast.statusFailedReason', { reasonKey: getErrorMessageKey(error) });
        }
      } finally {
        inFlight.current.delete(task.id);
        setUpdatingIds(new Set(inFlight.current));
      }
    },
    [toast]
  );

  const isUpdating = useCallback((id) => updatingIds.has(id), [updatingIds]);

  return { toggle, isUpdating };
}
