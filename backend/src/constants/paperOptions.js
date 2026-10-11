/**
 * Stable, language-independent values stored in the database.
 * The frontend translates these into display labels.
 *
 * To support a new option, add its value here (and its label to the
 * frontend translation dictionaries). No schema migration is needed.
 */
export const PAPER_TYPES = Object.freeze([
  'glossy',
  'matte',
  'offset',
  'art_paper',
  'bond_paper',
  'other',
]);

export const PAPER_SIZES = Object.freeze(['A2', 'A3', 'A4', 'A5', 'custom']);

// When paperSize is "custom", customPaperSize { width, height, unit } is required.
export const CUSTOM_PAPER_SIZE = 'custom';

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
