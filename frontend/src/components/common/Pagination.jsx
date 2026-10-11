import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n.js';

/** Page numbers to show: first, last, and a window around the current page, with gaps. */
function getPageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) items.push(`gap-${p}`);
    items.push(p);
  });
  return items;
}

export default function Pagination({ page, totalPages, limit, total, onPageChange, disabled = false }) {
  const { t } = useI18n();
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const items = getPageItems(page, totalPages);

  return (
    <nav className="pagination" aria-label={t('pagination.label')}>
      <p className="pagination__summary">{t('pagination.summary', { from, to, total })}</p>
      {totalPages > 1 && (
        <ul className="pagination__pages">
          <li>
            <button
              type="button"
              className="pagination__btn"
              aria-label={t('pagination.previous')}
              disabled={disabled || page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              {/* ChevronLeft points "back" in LTR; .flip-rtl mirrors it in RTL */}
              <ChevronLeft size={18} className="flip-rtl" aria-hidden="true" />
            </button>
          </li>
          {items.map((item) =>
            typeof item === 'string' ? (
              <li key={item} className="pagination__gap" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={item}>
                <button
                  type="button"
                  className="pagination__btn"
                  aria-label={t('pagination.page', { page: item })}
                  aria-current={item === page ? 'page' : undefined}
                  disabled={disabled}
                  onClick={() => item !== page && onPageChange(item)}
                >
                  {t('pagination.pageNumber', { page: item })}
                </button>
              </li>
            )
          )}
          <li>
            <button
              type="button"
              className="pagination__btn"
              aria-label={t('pagination.next')}
              disabled={disabled || page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight size={18} className="flip-rtl" aria-hidden="true" />
            </button>
          </li>
        </ul>
      )}
    </nav>
  );
}
