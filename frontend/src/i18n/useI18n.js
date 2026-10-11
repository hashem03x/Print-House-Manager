import { useContext } from 'react';
import { I18nContext } from './I18nContext.js';

/**
 * Returns { t, language, dir, locale, numberingSystem, setLanguage, languages }.
 * Usage: const { t } = useI18n(); t('tasks.title'); t('pagination.page', { page: 2 });
 */
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>');
  return context;
}
