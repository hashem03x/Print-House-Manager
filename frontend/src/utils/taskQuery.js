import { PAPER_SIZES, PAPER_TYPES, PAPER_WEIGHTS, TASK_STATUSES } from '../constants/paperOptions.js';

// The Tasks page keeps its search/filter/sort/page state in the URL so it
// survives refreshes and can be shared.
export const PAGE_SIZE = 10;
export const DEFAULT_SORT = 'createdAt:desc';
export const SORT_OPTIONS = [
  'createdAt:desc',
  'createdAt:asc',
  'taskDate:desc',
  'taskDate:asc',
  'total:desc',
  'total:asc',
  'price:desc',
  'price:asc',
];

export function readTaskQuery(searchParams) {
  const paperType = searchParams.get('paperType') ?? '';
  const paperSize = searchParams.get('paperSize') ?? '';
  const paperWeight = searchParams.get('paperWeight') ?? '';
  const status = searchParams.get('status') ?? '';
  const sort = searchParams.get('sort') ?? DEFAULT_SORT;
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10);

  return {
    search: (searchParams.get('q') ?? '').trim(),
    paperType: PAPER_TYPES.includes(paperType) ? paperType : '',
    paperSize: PAPER_SIZES.includes(paperSize) ? paperSize : '',
    paperWeight: PAPER_WEIGHTS.includes(Number(paperWeight)) ? paperWeight : '',
    status: TASK_STATUSES.includes(status) ? status : '',
    sort: SORT_OPTIONS.includes(sort) ? sort : DEFAULT_SORT,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function toApiParams(query) {
  const [sortBy, order] = query.sort.split(':');
  return {
    search: query.search,
    paperType: query.paperType,
    paperSize: query.paperSize,
    paperWeight: query.paperWeight,
    status: query.status,
    sortBy,
    order,
    page: query.page,
    limit: PAGE_SIZE,
  };
}

/** Writes query values into URLSearchParams, omitting defaults to keep URLs clean. */
export function writeTaskQuery(query) {
  const params = new URLSearchParams();
  if (query.search) params.set('q', query.search);
  if (query.paperType) params.set('paperType', query.paperType);
  if (query.paperSize) params.set('paperSize', query.paperSize);
  if (query.paperWeight) params.set('paperWeight', query.paperWeight);
  if (query.status) params.set('status', query.status);
  if (query.sort && query.sort !== DEFAULT_SORT) params.set('sort', query.sort);
  if (query.page > 1) params.set('page', String(query.page));
  return params;
}

export function hasActiveFilters(query) {
  return Boolean(query.search || query.paperType || query.paperSize || query.paperWeight || query.status);
}
