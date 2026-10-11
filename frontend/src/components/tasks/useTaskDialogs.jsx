import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../common/Toast/useToast.js';
import DeleteTaskDialog from './DeleteTaskDialog.jsx';
import TaskDetailsModal from './TaskDetailsModal.jsx';
import TaskFormModal from './TaskFormModal.jsx';

/**
 * Shared controller for the create / view / edit / delete dialogs, used by
 * both the Dashboard and the Tasks page.
 *
 * @param onChanged (kind: 'created' | 'updated' | 'deleted') => void — refresh data here.
 * @returns {{ openCreate, openView, openEdit, openDelete, dialogs: JSX.Element }}
 */
export function useTaskDialogs({ onChanged }) {
  const toast = useToast();
  const [dialog, setDialog] = useState(null); // { type: 'create' | 'view' | 'edit' | 'delete', task? }
  const openerRef = useRef(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const open = useCallback((next) => {
    // Remember what opened the first dialog so focus can return there at the end.
    setDialog((current) => {
      if (!current) openerRef.current = document.activeElement;
      return next;
    });
  }, []);

  const close = useCallback(() => setDialog(null), []);

  // Return focus to the original trigger once the last dialog closes.
  useEffect(() => {
    if (dialog) return;
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  }, [dialog]);

  const notifyChanged = useCallback((kind) => onChangedRef.current?.(kind), []);

  let dialogs = null;
  if (dialog?.type === 'create' || dialog?.type === 'edit') {
    const isEdit = dialog.type === 'edit';
    dialogs = (
      <TaskFormModal
        key={isEdit ? `edit-${dialog.task.id}` : 'create'}
        mode={isEdit ? 'edit' : 'add'}
        task={dialog.task}
        onClose={close}
        onSaved={() => {
          toast.success(isEdit ? 'toast.updated' : 'toast.created');
          close();
          notifyChanged(isEdit ? 'updated' : 'created');
        }}
        onError={() => toast.error('toast.saveFailed')}
      />
    );
  } else if (dialog?.type === 'view') {
    dialogs = (
      <TaskDetailsModal
        key={`view-${dialog.task.id}`}
        task={dialog.task}
        onClose={close}
        onEdit={(task) => open({ type: 'edit', task })}
        onDelete={(task) => open({ type: 'delete', task })}
        onMissing={() => notifyChanged('deleted')}
        onStatusChanged={() => notifyChanged('updated')}
      />
    );
  } else if (dialog?.type === 'delete') {
    dialogs = (
      <DeleteTaskDialog
        key={`delete-${dialog.task.id}`}
        task={dialog.task}
        onClose={close}
        onDeleted={({ alreadyDeleted }) => {
          if (alreadyDeleted) toast.info('toast.alreadyDeleted');
          else toast.success('toast.deleted');
          close();
          notifyChanged('deleted');
        }}
        onError={() => toast.error('toast.deleteFailed')}
      />
    );
  }

  return {
    openCreate: useCallback(() => open({ type: 'create' }), [open]),
    openView: useCallback((task) => open({ type: 'view', task }), [open]),
    openEdit: useCallback((task) => open({ type: 'edit', task }), [open]),
    openDelete: useCallback((task) => open({ type: 'delete', task }), [open]),
    dialogs,
  };
}
