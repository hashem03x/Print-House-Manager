import { ClipboardList, Plus, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../components/common/Button.jsx';
import Card from '../components/common/Card.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Pagination from '../components/common/Pagination.jsx';
import Spinner from '../components/common/Spinner.jsx';
import TaskFilters from '../components/tasks/TaskFilters.jsx';
import TaskTable, { TaskTableSkeleton } from '../components/tasks/TaskTable.jsx';
import { useTaskDialogs } from '../components/tasks/useTaskDialogs.jsx';
import { useTaskStatusToggle } from '../components/tasks/useTaskStatusToggle.js';
import { useApiResource } from '../hooks/useApiResource.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useI18n } from '../i18n/useI18n.js';
import { listTasks } from '../services/taskApi.js';
import { getErrorMessageKey } from '../utils/apiErrors.js';
import { hasActiveFilters, readTaskQuery, toApiParams, writeTaskQuery } from '../utils/taskQuery.js';

export default function TasksPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => readTaskQuery(searchParams), [searchParams]);

  // Updates URL state. Any change other than the page number returns to page 1.
  const updateQuery = useCallback(
    (changes) => {
      setSearchParams(
        (previous) => {
          const current = readTaskQuery(previous);
          const resetPage = !('page' in changes);
          return writeTaskQuery({ ...current, ...changes, page: resetPage ? 1 : changes.page });
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Search box: typed text is debounced before it reaches the URL / API.
  const [searchText, setSearchText] = useState(query.search);
  const debouncedSearch = useDebouncedValue(searchText.trim(), 350);
  useEffect(() => {
    if (debouncedSearch !== query.search) updateQuery({ search: debouncedSearch });
    // Only react to the debounced text, not to URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const apiParams = useMemo(() => toApiParams(query), [query]);
  const { data, error, isLoading, reload, mutate } = useApiResource(
    (signal) => listTasks(apiParams, { signal }),
    JSON.stringify(apiParams)
  );

  // If the current page no longer exists (e.g. after deleting its last task), go to the last page.
  const totalPages = data?.pagination.totalPages;
  useEffect(() => {
    if (totalPages && query.page > totalPages) updateQuery({ page: totalPages });
  }, [totalPages, query.page, updateQuery]);

  const { openCreate, openView, openEdit, openDelete, dialogs } = useTaskDialogs({ onChanged: reload });

  // Status changes update the row in place from the API response; when a status
  // filter is active the task may no longer belong on this page, so refetch.
  const { toggle: toggleStatus, isUpdating: isUpdatingStatus } = useTaskStatusToggle({
    onUpdated: (updated) => {
      mutate((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === updated.id ? updated : task)),
      }));
      if (query.status) reload();
    },
    onMissing: reload,
  });

  const filtersActive = hasActiveFilters(query);
  const tasks = data?.tasks ?? [];
  const pagination = data?.pagination;

  function clearFilters() {
    setSearchText('');
    updateQuery({ search: '', paperType: '', paperSize: '', paperWeight: '', status: '' });
  }

  let content;
  if (error && !data) {
    content = (
      <ErrorState
        title={t('tasks.loadError.title')}
        message={t(getErrorMessageKey(error))}
        retryLabel={t('common.retry')}
        onRetry={reload}
      />
    );
  } else if (!data) {
    content = <TaskTableSkeleton />;
  } else if (tasks.length === 0 && !isLoading) {
    content = filtersActive ? (
      <EmptyState
        icon={SearchX}
        title={t('tasks.noResults.title')}
        description={t('tasks.noResults.description')}
        action={
          <Button variant="secondary" onClick={clearFilters}>
            {t('common.clearFilters')}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={ClipboardList}
        title={t('tasks.empty.title')}
        description={t('tasks.empty.description')}
        action={
          <Button icon={Plus} onClick={openCreate}>
            {t('tasks.empty.action')}
          </Button>
        }
      />
    );
  } else {
    content = (
      <>
        {error && (
          <div className="tasks-panel__inline-error">
            <ErrorState compact message={t(getErrorMessageKey(error))} retryLabel={t('common.retry')} onRetry={reload} />
          </div>
        )}
        <TaskTable
          tasks={tasks}
          sort={query.sort}
          onSortChange={(sort) => updateQuery({ sort })}
          onView={openView}
          onEdit={openEdit}
          onDelete={openDelete}
          onToggleStatus={toggleStatus}
          isUpdatingStatus={isUpdatingStatus}
          busy={isLoading}
        />
        <div className="tasks-panel__footer">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            limit={pagination.limit}
            total={pagination.total}
            disabled={isLoading}
            onPageChange={(page) => updateQuery({ page })}
          />
        </div>
      </>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={t('tasks.title')}
        description={t('tasks.subtitle')}
        actions={
          <Button icon={Plus} onClick={openCreate}>
            {t('common.addTask')}
          </Button>
        }
      />

      <Card className="tasks-panel" aria-labelledby="tasks-panel-count">
        <div className="tasks-panel__toolbar">
          <TaskFilters
            searchText={searchText}
            paperType={query.paperType}
            paperSize={query.paperSize}
            paperWeight={query.paperWeight}
            status={query.status}
            sort={query.sort}
            showClear={filtersActive}
            onSearchTextChange={setSearchText}
            onPaperTypeChange={(paperType) => updateQuery({ paperType })}
            onPaperSizeChange={(paperSize) => updateQuery({ paperSize })}
            onPaperWeightChange={(paperWeight) => updateQuery({ paperWeight })}
            onStatusChange={(status) => updateQuery({ status })}
            onSortChange={(sort) => updateQuery({ sort })}
            onClear={clearFilters}
          />
        </div>
        <div className="tasks-panel__status">
          <p id="tasks-panel-count" className="tasks-panel__count" aria-live="polite">
            {pagination ? t('tasks.resultsCount', { count: pagination.total }) : t('common.loading')}
          </p>
          {isLoading && data && (
            <span className="tasks-panel__updating">
              <Spinner size={14} /> {t('tasks.updating')}
            </span>
          )}
        </div>
        <div className={`progress-bar ${isLoading ? 'is-active' : ''}`} aria-hidden="true" />
        {content}
      </Card>

      {dialogs}
    </div>
  );
}
