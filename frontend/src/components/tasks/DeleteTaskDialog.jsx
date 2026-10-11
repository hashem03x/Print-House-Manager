import { CircleAlert, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { deleteTask } from '../../services/taskApi.js';
import { getErrorMessageKey, isTaskNotFound } from '../../utils/apiErrors.js';
import Button from '../common/Button.jsx';
import Modal from '../common/Modal.jsx';

// Unicode isolates keep a description in the other script from scrambling the sentence.
const isolate = (text) => `⁨${text}⁩`;
const truncate = (text, max = 80) => (text.length > max ? `${text.slice(0, max)}…` : text);

/**
 * Confirmation before permanent deletion. Focus starts on Cancel (the safe choice).
 * @param onDeleted ({ alreadyDeleted: boolean }) => void
 */
export default function DeleteTaskDialog({ task, onClose, onDeleted, onError }) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  const deletingRef = useRef(false);

  async function handleConfirm() {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);
    setErrorKey(null);
    try {
      await deleteTask(task.id);
      onDeleted({ alreadyDeleted: false });
    } catch (error) {
      if (isTaskNotFound(error)) {
        onDeleted({ alreadyDeleted: true });
        return;
      }
      setErrorKey(getErrorMessageKey(error));
      onError?.(error);
      deletingRef.current = false;
      setIsDeleting(false);
    }
  }

  return (
    <Modal
      isOpen
      role="alertdialog"
      size="sm"
      titleId="delete-task-title"
      title={t('deleteDialog.title')}
      closeLabel={t('common.close')}
      onClose={onClose}
      busy={isDeleting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isDeleting} data-autofocus>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={isDeleting} onClick={handleConfirm}>
            {t(isDeleting ? 'deleteDialog.deleting' : 'deleteDialog.confirm')}
          </Button>
        </>
      }
    >
      <div className="confirm-body">
        <span className="confirm-body__icon" aria-hidden="true">
          <TriangleAlert size={22} />
        </span>
        <p className="confirm-body__message">
          {t('deleteDialog.message', { description: isolate(truncate(task.description)) })}
        </p>
      </div>
      {errorKey && (
        <div className="form-alert" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <p>{t(errorKey)}</p>
        </div>
      )}
    </Modal>
  );
}
