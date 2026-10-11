import ar from './locales/ar.js';
import en from './locales/en.js';

// `locale` drives Intl date/number formatting. Arabic uses Latin digits
// (numberingSystem: 'latn') for readability in tables and prices.
export const LANGUAGES = {
  ar: {
    code: 'ar',
    label: 'العربية',
    shortLabel: 'ع',
    dir: 'rtl',
    locale: 'ar-EG',
    numberingSystem: 'latn',
    messages: ar,
  },
  en: {
    code: 'en',
    label: 'English',
    shortLabel: 'EN',
    dir: 'ltr',
    locale: 'en-GB',
    numberingSystem: 'latn',
    messages: en,
  },
};

export const FALLBACK_LANGUAGE = 'en';
