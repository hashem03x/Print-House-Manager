// Display-only formatting helpers. They never modify stored data.
import { APP_CONFIG } from '../config/appConfig.js';

/**
 * taskDate is a calendar date stored as UTC midnight, so it is formatted in
 * UTC to show the same day in every time zone.
 */
export function formatTaskDate(value, locale, numberingSystem = 'latn') {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    numberingSystem,
  }).format(new Date(value));
}

/** createdAt / updatedAt are real instants: shown in the viewer's local time zone. */
export function formatDate(value, locale, numberingSystem = 'latn') {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    numberingSystem,
  }).format(new Date(value));
}

export function formatTime(value, locale, numberingSystem = 'latn') {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    numberingSystem,
  }).format(new Date(value));
}

export function formatDateTime(value, locale, numberingSystem = 'latn') {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    numberingSystem,
  }).format(new Date(value));
}

export function formatCurrency(value, locale, numberingSystem = 'latn') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: APP_CONFIG.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem,
  }).format(value);
}

export function formatNumber(value, locale, numberingSystem = 'latn') {
  // Up to 3 decimals so dimensions such as 0.325 m display exactly as entered.
  return new Intl.NumberFormat(locale, { numberingSystem, maximumFractionDigits: 3 }).format(value);
}

/** Today's date in the browser's time zone as "YYYY-MM-DD" (default for new tasks). */
export function todayInputValue() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** API taskDate ("2026-10-20T00:00:00.000Z") -> date input value ("2026-10-20"). */
export function toDateInputValue(value) {
  return value ? String(value).slice(0, 10) : '';
}
