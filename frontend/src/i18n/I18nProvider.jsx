import { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_CONFIG } from '../config/appConfig.js';
import { I18nContext } from './I18nContext.js';
import { FALLBACK_LANGUAGE, LANGUAGES } from './languages.js';

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(APP_CONFIG.languageStorageKey);
    if (stored && LANGUAGES[stored]) return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
  }
  return APP_CONFIG.defaultLanguage;
}

function lookup(messages, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), messages);
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);
  const config = LANGUAGES[language];

  const t = useCallback(
    (key, params) => {
      let value = lookup(config.messages, key);
      let locale = config.locale;
      if (value === undefined) {
        value = lookup(LANGUAGES[FALLBACK_LANGUAGE].messages, key);
        locale = LANGUAGES[FALLBACK_LANGUAGE].locale;
      }

      // Plural entries are objects keyed by Intl plural category (zero/one/two/few/many/other).
      if (value && typeof value === 'object' && typeof params?.count === 'number') {
        // An explicit "zero" entry wins for 0 in every language (English rules have no "zero").
        const category =
          params.count === 0 && value.zero ? 'zero' : new Intl.PluralRules(locale).select(params.count);
        value = value[category] ?? value.other;
      }

      if (typeof value !== 'string') {
        if (import.meta.env.DEV) console.warn(`[i18n] Missing translation: "${key}"`);
        return key;
      }
      if (!params) return value;

      const numberFormat = new Intl.NumberFormat(config.locale, { numberingSystem: config.numberingSystem });
      return value.replace(/\{\{(\w+)\}\}/g, (match, name) => {
        const param = params[name];
        if (param === undefined) return match;
        return typeof param === 'number' ? numberFormat.format(param) : String(param);
      });
    },
    [config]
  );

  const setLanguage = useCallback((next) => {
    if (LANGUAGES[next]) setLanguageState(next);
  }, []);

  // Keep <html lang/dir>, the tab title and the stored preference in sync.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = config.code;
    root.dir = config.dir;
    document.title = t('app.name');
    try {
      localStorage.setItem(APP_CONFIG.languageStorageKey, config.code);
    } catch {
      // Ignore — the preference simply won't persist.
    }
  }, [config, t]);

  const value = useMemo(
    () => ({
      t,
      language: config.code,
      dir: config.dir,
      locale: config.locale,
      numberingSystem: config.numberingSystem,
      languages: Object.values(LANGUAGES),
      setLanguage,
    }),
    [t, config, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
