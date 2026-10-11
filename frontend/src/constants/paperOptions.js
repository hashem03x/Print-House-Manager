// Stable values — must match backend/src/constants/paperOptions.js.
// Display labels live in the translation dictionaries under
// `paperTypes.<value>`, `paperSizes.<value>` and `status.<value>`.
export const PAPER_TYPES = [
  'bristol',
  'glossy_heavy',
  'glossy_light',
  'glossy_two_side',
  'matte_sticker',
  'glossy_sticker',
  'carbon_original_copy',
  'carbon_original_two_copies',
];

// Retired values that may still exist on older tasks: shown with their labels,
// kept when such a task is edited, but not offered for new choices.
export const LEGACY_PAPER_TYPES = ['glossy', 'matte', 'offset', 'art_paper', 'bond_paper', 'other'];

export const PAPER_SIZES = ['A6', 'A4', 'A5', 'size_9', 'size_18', 'size_16', 'custom'];
export const LEGACY_PAPER_SIZES = ['A2', 'A3'];

// Whole number of items per task. Older tasks without one count as 1.
export const DEFAULT_QUANTITY = 1;
export const MAX_QUANTITY = 1_000_000;

// Grams per square meter. Labels: `paperWeights.<value>`.
export const PAPER_WEIGHTS = [70, 80, 100, 120];

// "custom" requires customPaperSize { width, height, unit }.
export const CUSTOM_PAPER_SIZE = 'custom';

// Dimension units and their size in millimeters (for the 10 m upper bound only;
// values are stored and shown in the unit the user chose, never converted).
export const DIMENSION_UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4 };
export const DEFAULT_DIMENSION_UNIT = 'mm';
export const MAX_DIMENSION_MM = 10_000;

export const TASK_STATUSES = ['pending', 'completed'];
