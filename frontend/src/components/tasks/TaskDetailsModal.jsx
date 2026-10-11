import { CircleCheck, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useApiResource } from '../../hooks/useApiResource.js';
import { useI18n } from '../../i18n/useI18n.js';
import { getTask } from '../../services/taskApi.js';
import { getErrorMessageKey, isTaskNotFound } from '../../utils/apiErrors.js';
import { formatCurrency, formatDateTime, formatTaskDate } from '../../utils/format.js';
import Button from '../common/Button.jsx';
import ErrorState from '../common/ErrorState.jsx';
import Modal from '../common/Modal.jsx';
import { PaperSizeBadge, PaperTypeBadge, PaperWeightBadge, StatusBadge } from '../common/PaperBadges.jsx';
import Spinner from '../common/Spinner.jsx';
import { useTaskStatusToggle } from './useTaskStatusToggle.js';

/**
 * Shows a task immediately from the list data, then refreshes it from
 * GET /api/tasks/:id so the details are always current.
 * @param onMissing Called once if the task no longer exists (404).
 * @param onStatusChanged Called after the status was changed here, so lists can refresh.
 */
export default function TaskDetailsModal({ task: initialTask, onClose, onEdit, onDelete, onMissing, onStatusChanged }) {
  const { t, locale, numberingSystem } = useI18n();
  const { data, error, isLoading, reload, mutate } = useApiResource(
    (signal) => getTask(initialTask.id, { signal }),
    initialTask.id
  );
  const task = data ?? initialTask;
  const isMissing = isTaskNotFound(error);
  const { toggle, isUpdating } = useTaskStatusToggle({
    onUpdated: (updated) => {
      mutate(() => updated);
      onStatusChanged?.(updated);
    },
    onMissing: () => onMissing?.(),
  });
  const isCompleted = task.status === 'completed';

  const reportedMissing = useRef(false);
  useEffect(() => {
    if (isMissing && !reportedMissing.current) {
      reportedMissing.current = true;
      onMissing?.();
    }
  }, [isMissing, onMissing]);

  return (
    <Modal
      isOpen
      titleId="task-details-title"
      title={t('taskDetails.title')}
      description={t('taskDetails.subtitle')}
      closeLabel={t('common.close')}
      onClose={onClose}
      footer={
        <>
          {!isMissing && (
            <Button variant="danger-ghost" icon={Trash2} className="modal__footer-start" onClick={() => onDelete(task)}>
              {t('common.delete')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} data-autofocus={isMissing || undefined}>
            {t('common.close')}
          </Button>
          {!isMissing && (
            <Button
              variant="secondary"
              icon={isCompleted ? RotateCcw : CircleCheck}
              loading={isUpdating(task.id)}
              disabled={!data}
              onClick={() => toggle(task)}
            >
              {t(isCompleted ? 'tasks.markPending' : 'tasks.markCompleted')}
            </Button>
          )}
          {!isMissing && (
            <Button icon={Pencil} onClick={() => onEdit(task)} data-autofocus>
              {t('common.edit')}
            </Button>
          )}
        </>
      }
    >
      {isMissing ? (
        <ErrorState compact message={t('taskDetails.notFound')} />
      ) : (
        <>
          {error && (
            <ErrorState
              compact
              message={t(getErrorMessageKey(error))}
              retryLabel={t('common.retry')}
              onRetry={reload}
            />
          )}
          <div className="task-details" aria-busy={isLoading || undefined}>
            <p className="task-details__description" dir="auto">
              {task.description}
            </p>
            <dl className="task-details__grid">
              <div>
                <dt>{t('status.label')}</dt>
                <dd><StatusBadge status={task.status} /></dd>
              </div>
              <div>
                <dt>{t('tasks.table.taskDate')}</dt>
                <dd>{formatTaskDate(task.taskDate, locale, numberingSystem)}</dd>
              </div>
              <div>
                <dt>{t('tasks.table.price')}</dt>
                <dd className="num task-details__price">{formatCurrency(task.price, locale, numberingSystem)}</dd>
              </div>
              <div>
                <dt>{t('tasks.table.paperType')}</dt>
                <dd><PaperTypeBadge value={task.paperType} /></dd>
              </div>
              <div>
                <dt>{t('tasks.table.paperSize')}</dt>
                <dd><PaperSizeBadge value={task.paperSize} dimensions={task.customPaperSize} /></dd>
              </div>
              <div>
                <dt>{t('tasks.table.paperWeight')}</dt>
                <dd><PaperWeightBadge value={task.paperWeight} /></dd>
              </div>
              <div>
                <dt>{t('taskDetails.createdAt')}</dt>
                <dd>{formatDateTime(task.createdAt, locale, numberingSystem)}</dd>
              </div>
              <div>
                <dt>{t('taskDetails.updatedAt')}</dt>
                <dd>{formatDateTime(task.updatedAt, locale, numberingSystem)}</dd>
              </div>
            </dl>
            {isLoading && (
              <p className="task-details__status">
                <Spinner size={14} /> {t('taskDetails.refreshing')}
              </p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
