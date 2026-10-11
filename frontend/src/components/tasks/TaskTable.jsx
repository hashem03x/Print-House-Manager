import { ArrowDown, ArrowUp, ArrowUpDown, CircleCheck, Eye, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';
import { formatCurrency, formatDate, formatTaskDate, formatTime } from '../../utils/format.js';
import IconButton from '../common/IconButton.jsx';
import { PaperSizeBadge, PaperTypeBadge, StatusBadge } from '../common/PaperBadges.jsx';

const SORTABLE = ['taskDate', 'price', 'createdAt'];

function SortableHeader({ field, label, sort, onSortChange, className = '' }) {
  const { t } = useI18n();
  const [sortBy, order] = sort.split(':');
  const isActive = sortBy === field;
  const Icon = !isActive ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  // Clicking an inactive column sorts descending first (newest / highest).
  const nextSort = isActive && order === 'desc' ? `${field}:asc` : `${field}:desc`;

  return (
    <th
      scope="col"
      className={className}
      aria-sort={isActive ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className={`th-sort ${isActive ? 'is-active' : ''}`}
        onClick={() => onSortChange(nextSort)}
        title={t('tasks.table.sortBy', { column: label })}
      >
        <span>{label}</span>
        <Icon size={14} aria-hidden="true" />
      </button>
    </th>
  );
}

/**
 * Renders the current page of tasks. `data-label` attributes power the
 * stacked card layout on small screens.
 */
export default function TaskTable({
  tasks,
  sort,
  onSortChange,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
  isUpdatingStatus = () => false,
  busy = false,
}) {
  const { t, locale, numberingSystem } = useI18n();

  const columns = {
    description: t('tasks.table.description'),
    status: t('tasks.table.status'),
    taskDate: t('tasks.table.taskDate'),
    paperType: t('tasks.table.paperType'),
    paperSize: t('tasks.table.paperSize'),
    price: t('tasks.table.price'),
    createdAt: t('tasks.table.createdAt'),
    actions: t('tasks.table.actions'),
  };

  const header = (field, className) =>
    SORTABLE.includes(field) ? (
      <SortableHeader field={field} label={columns[field]} sort={sort} onSortChange={onSortChange} className={className} />
    ) : (
      <th scope="col" className={className}>{columns[field]}</th>
    );

  return (
    <div className={`table-wrap ${busy ? 'is-busy' : ''}`} aria-busy={busy || undefined}>
      <table className="task-table">
        <caption className="visually-hidden">{t('tasks.table.caption')}</caption>
        <thead>
          <tr>
            {header('description', 'col-description')}
            {header('status')}
            {header('taskDate')}
            {header('paperType')}
            {header('paperSize')}
            {header('price', 'col-num')}
            {header('createdAt')}
            <th scope="col" className="col-actions">
              <span className="visually-hidden">{columns.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td data-label={columns.description} className="col-description">
                <button
                  type="button"
                  className="task-table__description"
                  dir="auto"
                  onClick={() => onView(task)}
                  title={t('tasks.viewTask')}
                >
                  {task.description}
                </button>
              </td>
              <td data-label={columns.status}>
                <StatusBadge status={task.status} />
              </td>
              <td data-label={columns.taskDate} className="nowrap">
                {formatTaskDate(task.taskDate, locale, numberingSystem)}
              </td>
              <td data-label={columns.paperType}>
                <PaperTypeBadge value={task.paperType} />
              </td>
              <td data-label={columns.paperSize}>
                <PaperSizeBadge value={task.paperSize} dimensions={task.customPaperSize} />
              </td>
              <td data-label={columns.price} className="col-num num nowrap">
                {formatCurrency(task.price, locale, numberingSystem)}
              </td>
              <td data-label={columns.createdAt} className="nowrap">
                <span className="task-table__created">
                  {formatDate(task.createdAt, locale, numberingSystem)}
                  <span className="task-table__time">{formatTime(task.createdAt, locale, numberingSystem)}</span>
                </span>
              </td>
              <td className="col-actions">
                <div className="task-table__actions">
                  <IconButton
                    icon={task.status === 'completed' ? RotateCcw : CircleCheck}
                    variant={task.status === 'completed' ? 'default' : 'success'}
                    label={`${t(task.status === 'completed' ? 'tasks.markPending' : 'tasks.markCompleted')}: ${task.description}`}
                    loading={isUpdatingStatus(task.id)}
                    onClick={() => onToggleStatus(task)}
                  />
                  <IconButton icon={Eye} label={`${t('tasks.viewTask')}: ${task.description}`} onClick={() => onView(task)} />
                  <IconButton icon={Pencil} label={`${t('tasks.editTask')}: ${task.description}`} onClick={() => onEdit(task)} />
                  <IconButton
                    icon={Trash2}
                    variant="danger"
                    label={`${t('tasks.deleteTask')}: ${task.description}`}
                    onClick={() => onDelete(task)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Placeholder rows shown during the first load. */
export function TaskTableSkeleton({ rows = 6 }) {
  const { t } = useI18n();
  return (
    <div className="table-skeleton" role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="table-skeleton__row" aria-hidden="true">
          <span className="skeleton skeleton--wide" />
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton skeleton--short" />
          <span className="skeleton" />
        </div>
      ))}
    </div>
  );
}
