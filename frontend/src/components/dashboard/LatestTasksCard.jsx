import { ArrowRight, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n.js';
import { formatCurrency, formatTaskDate } from '../../utils/format.js';
import Card from '../common/Card.jsx';
import EmptyState from '../common/EmptyState.jsx';
import { PaperSizeBadge, PaperTypeBadge, PaperWeightBadge, StatusBadge } from '../common/PaperBadges.jsx';

export default function LatestTasksCard({ tasks, loading, onView, emptyAction }) {
  const { t, locale, numberingSystem } = useI18n();

  let content;
  if (loading) {
    content = (
      <ul className="latest-tasks__list" role="status" aria-label={t('common.loading')}>
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="latest-tasks__item" aria-hidden="true">
            <div className="latest-tasks__main">
              <span className="skeleton skeleton--wide" />
              <span className="skeleton skeleton--short" />
            </div>
            <span className="skeleton skeleton--short" />
          </li>
        ))}
      </ul>
    );
  } else if (tasks.length === 0) {
    content = (
      <EmptyState
        icon={ClipboardList}
        title={t('dashboard.latestTasks.emptyTitle')}
        description={t('dashboard.latestTasks.emptyDescription')}
        action={emptyAction}
      />
    );
  } else {
    content = (
      <ul className="latest-tasks__list">
        {tasks.map((task) => (
          <li key={task.id}>
            <button type="button" className="latest-tasks__item latest-tasks__item--button" onClick={() => onView(task)}>
              <span className="latest-tasks__main">
                <span className="latest-tasks__description" dir="auto">
                  {task.description}
                </span>
                <span className="latest-tasks__meta">
                  <StatusBadge status={task.status} />
                  <PaperTypeBadge value={task.paperType} />
                  <PaperSizeBadge value={task.paperSize} dimensions={task.customPaperSize} />
                  {task.paperWeight != null && <PaperWeightBadge value={task.paperWeight} />}
                  <span className="latest-tasks__date">{formatTaskDate(task.taskDate, locale, numberingSystem)}</span>
                </span>
              </span>
              <span className="latest-tasks__price num">{formatCurrency(task.price, locale, numberingSystem)}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card className="latest-tasks" aria-labelledby="latest-tasks-title">
      <header className="card__header">
        <div>
          <h2 id="latest-tasks-title" className="card__title">
            {t('dashboard.latestTasks.title')}
          </h2>
          <p className="card__subtitle">{t('dashboard.latestTasks.subtitle')}</p>
        </div>
        <Link to="/tasks" className="text-link">
          {t('common.viewAll')}
          <ArrowRight size={16} className="flip-rtl" aria-hidden="true" />
        </Link>
      </header>
      {content}
    </Card>
  );
}
