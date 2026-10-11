import { ArrowDownUp, X } from 'lucide-react';
import { PAPER_SIZES, PAPER_TYPES, PAPER_WEIGHTS, TASK_STATUSES } from '../../constants/paperOptions.js';
import { useI18n } from '../../i18n/useI18n.js';
import { SORT_OPTIONS } from '../../utils/taskQuery.js';
import Button from '../common/Button.jsx';
import SearchInput from '../common/SearchInput.jsx';
import Select from '../common/Select.jsx';

/** Controlled search / filter / sort toolbar. */
export default function TaskFilters({
  searchText,
  paperType,
  paperSize,
  paperWeight,
  status,
  sort,
  showClear,
  onSearchTextChange,
  onPaperTypeChange,
  onPaperSizeChange,
  onPaperWeightChange,
  onStatusChange,
  onSortChange,
  onClear,
}) {
  const { t } = useI18n();

  const paperTypeOptions = PAPER_TYPES.map((value) => ({ value, label: t(`paperTypes.${value}`) }));
  const paperSizeOptions = PAPER_SIZES.map((value) => ({ value, label: t(`paperSizes.${value}`) }));
  const paperWeightOptions = PAPER_WEIGHTS.map((value) => ({ value: String(value), label: t(`paperWeights.${value}`) }));
  const statusOptions = TASK_STATUSES.map((value) => ({ value, label: t(`status.${value}`) }));
  const sortOptions = SORT_OPTIONS.map((value) => ({ value, label: t(`tasks.sort.${value}`) }));

  return (
    <div className="task-filters" role="search" aria-label={t('tasks.toolbarLabel')}>
      <SearchInput
        id="task-search"
        label={t('tasks.searchLabel')}
        placeholder={t('tasks.searchPlaceholder')}
        value={searchText}
        onChange={(event) => onSearchTextChange(event.target.value)}
        maxLength={100}
      />
      <div className="task-filters__selects">
        <Select
          aria-label={t('status.filter')}
          placeholder={t('status.all')}
          options={statusOptions}
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className={status ? 'is-active' : ''}
        />
        <Select
          aria-label={t('tasks.paperTypeFilter')}
          placeholder={t('tasks.allPaperTypes')}
          options={paperTypeOptions}
          value={paperType}
          onChange={(event) => onPaperTypeChange(event.target.value)}
          className={paperType ? 'is-active' : ''}
        />
        <Select
          aria-label={t('tasks.paperSizeFilter')}
          placeholder={t('tasks.allPaperSizes')}
          options={paperSizeOptions}
          value={paperSize}
          onChange={(event) => onPaperSizeChange(event.target.value)}
          className={paperSize ? 'is-active' : ''}
        />
        <Select
          aria-label={t('tasks.paperWeightFilter')}
          placeholder={t('tasks.allPaperWeights')}
          options={paperWeightOptions}
          value={paperWeight}
          onChange={(event) => onPaperWeightChange(event.target.value)}
          className={paperWeight ? 'is-active' : ''}
        />
        <Select
          aria-label={t('tasks.sortLabel')}
          options={sortOptions}
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          icon={ArrowDownUp}
          className="task-filters__sort"
        />
        {showClear && (
          <Button variant="ghost" icon={X} onClick={onClear} className="task-filters__clear">
            {t('common.clearFilters')}
          </Button>
        )}
      </div>
    </div>
  );
}
