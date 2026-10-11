/**
 * Stable, language-independent values stored in the database.
 * The frontend translates these into display labels.
 *
 * To support a new option, add its value here (and its label to the
 * frontend translation dictionaries). No schema migration is needed.
 */
export const PAPER_TYPES = Object.freeze([
  'bristol',
  'glossy_heavy',
  'glossy_light',
  'glossy_two_side',
  'matte_sticker',
  'glossy_sticker',
  'carbon_original_copy', // carbonless: original + 1 copy
  'carbon_original_two_copies', // carbonless: original + 2 copies
]);

// Earlier paper types. They have no unambiguous equivalent in the current list,
// so stored tasks keep them unchanged: still readable and filterable, and an
// edit may keep the task's existing legacy value, but new values cannot be set.
export const LEGACY_PAPER_TYPES = Object.freeze(['glossy', 'matte', 'offset', 'art_paper', 'bond_paper', 'other']);

export const PAPER_SIZES = Object.freeze(['A6', 'A4', 'A5', 'size_9', 'size_18', 'size_16', 'custom']);

// Earlier predefined sizes, kept readable on existing tasks (same rules as above).
export const LEGACY_PAPER_SIZES = Object.freeze(['A2', 'A3']);

// When paperSize is "custom", customPaperSize { width, height, unit } is required.
export const CUSTOM_PAPER_SIZE = 'custom';

// Number of items in a task. Tasks created before this field existed are
// treated as quantity 1, so their stored price remains their total.
export const DEFAULT_QUANTITY = 1;
export const MAX_QUANTITY = 1_000_000;

// Paper weights in grams per square meter (gsm). Independent of paper type.
export const PAPER_WEIGHTS = Object.freeze([70, 80, 100, 120]);

// Units for custom dimensions, with their size in millimeters. Values are stored
// exactly as entered in the chosen unit (never converted). Older custom-size
// documents without a unit are treated as millimeters.
export const DIMENSION_UNITS = Object.freeze({ mm: 1, cm: 10, m: 1000, in: 25.4 });
export const DEFAULT_DIMENSION_UNIT = 'mm';
// Upper bound (10 m) applied after converting to millimeters, whatever the unit.
export const MAX_DIMENSION_MM = 10_000;

// Completion status. Documents created before this field existed have no
// status and are treated as "pending" everywhere (reads, filters, statistics).
export const TASK_STATUSES = Object.freeze(['pending', 'completed']);
export const DEFAULT_TASK_STATUS = 'pending';
