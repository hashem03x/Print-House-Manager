import {
  CUSTOM_PAPER_SIZE,
  DIMENSION_UNITS,
  MAX_DIMENSION_MM,
  PAPER_SIZES,
  PAPER_TYPES,
  PAPER_WEIGHTS,
} from '../constants/paperOptions.js';

// Mirrors backend rules for instant feedback. The backend remains authoritative.
export const DESCRIPTION_MAX_LENGTH = 500;
export const MAX_PRICE = 1_000_000_000;

const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g;

/** Accepts Arabic-Indic digits and the Arabic decimal separator as typed on Arabic keyboards. */
export function normalizeNumericInput(value) {
  return String(value ?? '')
    .trim()
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) & 0xf))
    .replace(/٫/g, '.') // Arabic decimal separator
    .replace(/[٬,\s]/g, ''); // thousands separators
}

export function isValidCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Returns a translation key for an invalid dimension in the given unit, or undefined. */
function validateDimension(raw, field, unit) {
  const value = normalizeNumericInput(raw);
  if (!value) return `validation.${field}Required`;
  if (!/^-?\d+(\.\d{1,3})?$/.test(value)) return `validation.${field}Invalid`;
  const number = Number(value);
  if (number <= 0) return `validation.${field}Positive`;
  if (DIMENSION_UNITS[unit] && number * DIMENSION_UNITS[unit] > MAX_DIMENSION_MM) return 'validation.dimensionTooLarge';
  return undefined;
}

/**
 * @param values Raw form values (strings).
 * @param original The task being edited (if any): its existing retired paper
 *   type/size may be kept, but cannot be newly chosen.
 * @returns Map of field -> translation key. Empty object when valid.
 */
export function validateTaskForm(values, original) {
  const errors = {};

  const description = values.description.trim();
  if (!description) errors.description = 'validation.descriptionRequired';
  else if (description.length > DESCRIPTION_MAX_LENGTH) errors.description = 'validation.descriptionTooLong';

  if (!values.taskDate) errors.taskDate = 'validation.taskDateRequired';
  else if (!isValidCalendarDate(values.taskDate)) errors.taskDate = 'validation.taskDateInvalid';

  const keepsOriginal = (field) => Boolean(original) && values[field] === original[field];
  if (!PAPER_TYPES.includes(values.paperType) && !keepsOriginal('paperType')) errors.paperType = 'validation.paperTypeRequired';
  if (!PAPER_SIZES.includes(values.paperSize) && !keepsOriginal('paperSize')) errors.paperSize = 'validation.paperSizeRequired';
  if (!PAPER_WEIGHTS.includes(Number(values.paperWeight)) || values.paperWeight === '') {
    errors.paperWeight = 'validation.paperWeightRequired';
  }

  // Dimensions are only validated (and only submitted) for a custom size.
  if (values.paperSize === CUSTOM_PAPER_SIZE) {
    if (!DIMENSION_UNITS[values.customUnit]) errors.customUnit = 'validation.unitRequired';
    const widthError = validateDimension(values.customWidth, 'width', values.customUnit);
    const heightError = validateDimension(values.customHeight, 'height', values.customUnit);
    if (widthError) errors.customWidth = widthError;
    if (heightError) errors.customHeight = heightError;
  }

  const price = normalizeNumericInput(values.price);
  if (!price) errors.price = 'validation.priceRequired';
  else if (price.startsWith('-')) errors.price = 'validation.priceMin';
  else if (!/^\d+(\.\d{1,2})?$/.test(price)) errors.price = 'validation.priceInvalid';
  else if (Number(price) > MAX_PRICE) errors.price = 'validation.priceTooLarge';

  return errors;
}

/**
 * Converts valid form values into the API payload. For predefined sizes,
 * customPaperSize is sent as null so stale dimensions are cleared on edit.
 */
export function toTaskPayload(values) {
  const isCustom = values.paperSize === CUSTOM_PAPER_SIZE;
  return {
    description: values.description.trim(),
    taskDate: values.taskDate,
    paperType: values.paperType,
    paperSize: values.paperSize,
    paperWeight: Number(values.paperWeight),
    customPaperSize: isCustom
      ? {
          width: Number(normalizeNumericInput(values.customWidth)),
          height: Number(normalizeNumericInput(values.customHeight)),
          unit: values.customUnit,
        }
      : null,
    price: Number(normalizeNumericInput(values.price)),
  };
}

/** Maps backend field errors (English) to localized field-level keys. */
export function mapServerErrors(serverErrors) {
  if (!serverErrors) return {};
  const errors = {};
  for (const field of ['description', 'taskDate', 'paperType', 'paperSize', 'paperWeight', 'price']) {
    if (serverErrors[field]) errors[field] = `validation.${field}Invalid`;
  }
  if (serverErrors['customPaperSize.width']) errors.customWidth = 'validation.widthInvalid';
  if (serverErrors['customPaperSize.height']) errors.customHeight = 'validation.heightInvalid';
  if (serverErrors['customPaperSize.unit']) errors.customUnit = 'validation.unitInvalid';
  if (serverErrors.customPaperSize) {
    errors.customWidth ??= 'validation.widthRequired';
    errors.customHeight ??= 'validation.heightRequired';
  }
  return errors;
}
