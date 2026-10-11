// Stable values — must match backend/src/constants/paperOptions.js.
// Display labels live in the translation dictionaries under
// `paperTypes.<value>`, `paperSizes.<value>` and `status.<value>`.
export const PAPER_TYPES = ['glossy', 'matte', 'offset', 'art_paper', 'bond_paper', 'other'];

export const PAPER_SIZES = ['A2', 'A3', 'A4', 'A5', 'custom'];

// "custom" requires customPaperSize { width, height, unit }.
export const CUSTOM_PAPER_SIZE = 'custom';

// Dimension units and their size in millimeters (for the 10 m upper bound only;
// values are stored and shown in the unit the user chose, never converted).
export const DIMENSION_UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4 };
export const DEFAULT_DIMENSION_UNIT = 'mm';
export const MAX_DIMENSION_MM = 10_000;

export const TASK_STATUSES = ['pending', 'completed'];
