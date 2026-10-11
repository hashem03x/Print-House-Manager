import { CalendarCheck, Clock, Files, Plus, Wallet } from 'lucide-react';
import Button from '../components/common/Button.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import LatestTasksCard from '../components/dashboard/LatestTasksCard.jsx';
import StatCard from '../components/dashboard/StatCard.jsx';
import { useTaskDialogs } from '../components/tasks/useTaskDialogs.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { useI18n } from '../i18n/useI18n.js';
import { getTaskStats } from '../services/taskApi.js';
import { getErrorMessageKey } from '../utils/apiErrors.js';
import { formatCurrency, formatNumber } from '../utils/format.js';

export default function DashboardPage() {
  const { t, locale, numberingSystem } = useI18n();

  // Statistics are computed by the backend from MongoDB; nothing is calculated here.
  const { data: stats, error, isLoading, reload } = useApiResource((signal) => getTaskStats({ signal }), 'stats');
  // Refresh after any create / edit / delete made from this page.
  const { openCreate, openView, dialogs } = useTaskDialogs({ onChanged: reload });

  const showSkeleton = isLoading && !stats;
  const addButton = (
    <Button icon={Plus} onClick={openCreate}>
      {t('common.addTask')}
    </Button>
  );

  return (
    <div className="page">
      <PageHeader title={t('dashboard.title')} description={t('dashboard.subtitle')} actions={addButton} />

      {error && !stats ? (
        <ErrorState
          title={t('dashboard.loadError.title')}
          message={t(getErrorMessageKey(error))}
          retryLabel={t('common.retry')}
          onRetry={reload}
        />
      ) : (
        <>
          {error && (
            <ErrorState compact message={t(getErrorMessageKey(error))} retryLabel={t('common.retry')} onRetry={reload} />
          )}
          <div className="stats-grid">
            <StatCard
              icon={Files}
              label={t('dashboard.stats.totalTasks')}
              value={stats && formatNumber(stats.totalTasks, locale, numberingSystem)}
              hint={t('dashboard.stats.totalTasksHint')}
              loading={showSkeleton}
            />
            <StatCard
              icon={CalendarCheck}
              tone="primary"
              label={t('dashboard.stats.tasksToday')}
              value={stats && formatNumber(stats.tasksToday, locale, numberingSystem)}
              hint={stats ? t('dashboard.stats.tasksTodayHint', { timeZone: stats.timeZone }) : ' '}
              loading={showSkeleton}
            />
            <StatCard
              icon={Clock}
              tone="accent"
              label={t('dashboard.stats.pendingTasks')}
              value={stats && formatNumber(stats.pendingTasks, locale, numberingSystem)}
              hint={stats ? t('dashboard.stats.pendingTasksHint', { count: stats.completedTasks }) : ' '}
              loading={showSkeleton}
            />
            <StatCard
              icon={Wallet}
              tone="neutral"
              label={t('dashboard.stats.totalValue')}
              value={stats && formatCurrency(stats.totalValue, locale, numberingSystem)}
              hint={t('dashboard.stats.totalValueHint')}
              loading={showSkeleton}
            />
          </div>

          <LatestTasksCard
            tasks={stats?.latestTasks ?? []}
            loading={showSkeleton}
            onView={openView}
            emptyAction={addButton}
          />
        </>
      )}

      {dialogs}
    </div>
  );
}
