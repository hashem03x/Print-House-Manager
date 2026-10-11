import {
  CUSTOM_PAPER_SIZE,
  DIMENSION_UNITS,
  LEGACY_PAPER_SIZES,
  LEGACY_PAPER_TYPES,
  MAX_DIMENSION_MM,
  MAX_QUANTITY,
  PAPER_SIZES,
  PAPER_TYPES,
  PAPER_WEIGHTS,
  TASK_STATUSES,
} from '../constants/paperOptions.js';
import { ApiError } from '../utils/ApiError.js';
import { parseCalendarDate } from '../utils/dates.js';

const DESCRIPTION_MAX_LENGTH = 500;
const MAX_PRICE = 1_000_000_000;

// Required on create, optional on update. Only whitelisted fields are ever
// written; anything else in the body (including _id, createdAt, updatedAt) is ignored.
const requiredFieldValidators = {
  description(value) {
    if (typeof value !== 'string') return 'Description must be a string';
    const trimmed = value.trim();
    if (!trimmed) return 'Description cannot be empty';
    if (trimmed.length > DESCRIPTION_MAX_LENGTH) {
      return `Description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`;
    }
    return { value: trimmed };
  },
  taskDate(value) {
    // Calendar date only, stored as UTC midnight (see utils/dates.js).
    const date = parseCalendarDate(value);
    if (!date) return 'Task date must be a valid date in YYYY-MM-DD format';
    return { value: date };
  },
  // Legacy values are accepted here and flagged; whether they are allowed is
  // decided later (never on create, only "unchanged" on update).
  paperType(value) {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    if (PAPER_TYPES.includes(trimmed)) return { value: trimmed };
    if (LEGACY_PAPER_TYPES.includes(trimmed)) return { value: trimmed, legacy: true };
    return `Paper type must be one of: ${PAPER_TYPES.join(', ')}`;
  },
  paperSize(value) {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    if (PAPER_SIZES.includes(trimmed)) return { value: trimmed };
    if (LEGACY_PAPER_SIZES.includes(trimmed)) return { value: trimmed, legacy: true };
    return `Paper size must be one of: ${PAPER_SIZES.join(', ')}`;
  },
  paperWeight(value) {
    if (typeof value !== 'number' || !PAPER_WEIGHTS.includes(value)) {
      return `Paper weight must be one of: ${PAPER_WEIGHTS.join(', ')} (gsm)`;
    }
    return { value };
  },
  price(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'Price must be a number';
    if (value < 0) return 'Price cannot be negative';
    if (value > MAX_PRICE) return `Price cannot exceed ${MAX_PRICE}`;
    // Store money with at most two decimal places.
    return { value: Math.round(value * 100) / 100 };
  },
  quantity(value) {
    if (typeof value !== 'number' || !Number.isInteger(value)) return 'Quantity must be a whole number';
    if (value < 1) return 'Quantity must be at least 1';
    if (value > MAX_QUANTITY) return `Quantity cannot exceed ${MAX_QUANTITY}`;
    return { value };
  },
};

const FIELD_LABELS = {
  description: 'Description',
  taskDate: 'Task date',
  paperType: 'Paper type',
  paperSize: 'Paper size',
  paperWeight: 'Paper weight',
  price: 'Price',
  quantity: 'Quantity',
};

export function validateStatusValue(value) {
  if (typeof value !== 'string' || !TASK_STATUSES.includes(value)) {
    return `Status must be one of: ${TASK_STATUSES.join(', ')}`;
  }
  return null;
}

const UNIT_NAMES = Object.keys(DIMENSION_UNITS);

function validateDimension(value, name, unit) {
  if (value === undefined || value === null || value === '') return `${name} is required for a custom paper size`;
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${name} must be a number`;
  if (value <= 0) return `${name} must be greater than 0`;
  const factor = DIMENSION_UNITS[unit];
  if (factor && value * factor > MAX_DIMENSION_MM) {
    return `${name} cannot exceed ${+(MAX_DIMENSION_MM / factor).toFixed(1)} ${unit}`;
  }
  return null;
}

/**
 * Validates `customPaperSize` ({ width, height, unit }), where unit is mm, cm, m or in.
 * null means "clear the dimensions"; undefined means "not provided".
 * Errors are keyed as customPaperSize.width / customPaperSize.height.
 */
function validateCustomPaperSize(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    errors.customPaperSize = 'Custom paper size must be an object with width, height and unit';
    return undefined;
  }
  const unitValid = typeof value.unit === 'string' && UNIT_NAMES.includes(value.unit);
  if (!unitValid) {
    errors['customPaperSize.unit'] =
      value.unit === undefined || value.unit === null || value.unit === ''
        ? 'Unit is required for a custom paper size'
        : `Unit must be one of: ${UNIT_NAMES.join(', ')}`;
  }
  const unit = unitValid ? value.unit : undefined;
  const widthError = validateDimension(value.width, 'Width', unit);
  const heightError = validateDimension(value.height, 'Height', unit);
  if (widthError) errors['customPaperSize.width'] = widthError;
  if (heightError) errors['customPaperSize.height'] = heightError;
  if (widthError || heightError || !unitValid) return undefined;
  // Stored in the chosen unit; only floating-point noise beyond 3 decimals is trimmed.
  const round = (n) => Math.round(n * 1000) / 1000;
  return { width: round(value.width), height: round(value.height), unit };
}

/**
 * Cross-field rule for paper size and dimensions:
 * - paperSize "custom"  -> dimensions required
 * - any other size      -> dimensions must be absent (they are cleared on save)
 * Returns the error map entries to add (empty when consistent).
 */
export function checkPaperSizeConsistency(paperSize, customPaperSize) {
  if (paperSize === CUSTOM_PAPER_SIZE && !customPaperSize) {
    return { customPaperSize: 'Width, height and unit are required when the paper size is custom' };
  }
  if (paperSize !== CUSTOM_PAPER_SIZE && customPaperSize) {
    return { customPaperSize: 'Custom dimensions are only allowed when the paper size is custom' };
  }
  return {};
}

/**
 * Validates and sanitizes a task payload, storing the result on req.taskData.
 * @param {{ partial?: boolean }} options partial=true allows a subset of fields (updates).
 *   For partial updates, the paper size / dimension consistency is checked in the
 *   controller against the stored task.
 */
export function validateTaskBody({ partial = false } = {}) {
  return (req, _res, next) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return next(ApiError.badRequest('Request body must be a JSON object'));
    }

    const errors = {};
    const data = {};
    const legacyFields = [];

    for (const [field, validate] of Object.entries(requiredFieldValidators)) {
      const value = body[field];
      if (value === undefined || value === null || value === '') {
        if (!partial) errors[field] = `${FIELD_LABELS[field]} is required`;
        continue;
      }
      const result = validate(value);
      if (typeof result === 'string') {
        errors[field] = result;
      } else {
        data[field] = result.value;
        if (result.legacy) legacyFields.push(field);
      }
    }

    // New tasks must use the current options; retired values cannot be chosen.
    if (!partial) {
      for (const field of legacyFields) {
        errors[field] = `"${data[field]}" is no longer available. ${requiredFieldValidators[field]('')}`;
      }
    }

    if (body.status !== undefined) {
      const statusError = validateStatusValue(body.status);
      if (statusError) errors.status = statusError;
      else data.status = body.status;
    }

    const dimensions = validateCustomPaperSize(body.customPaperSize, errors);
    if (dimensions !== undefined) data.customPaperSize = dimensions;

    if (!partial && !errors.paperSize && !Object.keys(errors).some((key) => key.startsWith('customPaperSize'))) {
      Object.assign(errors, checkPaperSizeConsistency(data.paperSize, data.customPaperSize));
    }

    if (Object.keys(errors).length > 0) {
      return next(ApiError.badRequest('Validation failed', errors));
    }
    if (!partial && data.customPaperSize === null) delete data.customPaperSize;
    if (partial && Object.keys(data).length === 0) {
      return next(
        ApiError.badRequest(
          `Provide at least one field to update: ${[...Object.keys(requiredFieldValidators), 'status', 'customPaperSize'].join(', ')}`
        )
      );
    }

    req.taskData = data;
    req.legacyFields = legacyFields;
    next();
  };
}

/** Validates the body of PATCH /api/tasks/:id/status. */
export function validateStatusBody(req, _res, next) {
  const status = req.body?.status;
  const error = validateStatusValue(status);
  if (error) return next(ApiError.badRequest('Validation failed', { status: error }));
  req.taskStatus = status;
  next();
}
