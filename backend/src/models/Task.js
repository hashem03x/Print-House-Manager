import mongoose from 'mongoose';
import {
  DEFAULT_DIMENSION_UNIT,
  DEFAULT_TASK_STATUS,
  DIMENSION_UNITS,
  LEGACY_PAPER_SIZES,
  LEGACY_PAPER_TYPES,
  MAX_DIMENSION_MM,
  PAPER_SIZES,
  PAPER_TYPES,
  PAPER_WEIGHTS,
  TASK_STATUSES,
} from '../constants/paperOptions.js';

const dimension = (label) => ({
  type: Number,
  required: [true, `${label} is required`],
  validate: {
    validator: (value) => value > 0,
    message: `${label} must be greater than 0`,
  },
});

// Sheet dimensions in the unit the user chose, only present when paperSize is "custom".
const customPaperSizeSchema = new mongoose.Schema(
  {
    width: dimension('Width'),
    height: dimension('Height'),
    // Legacy documents without a unit read back as millimeters.
    unit: {
      type: String,
      enum: { values: Object.keys(DIMENSION_UNITS), message: `Unit must be one of: ${Object.keys(DIMENSION_UNITS).join(', ')}` },
      default: DEFAULT_DIMENSION_UNIT,
    },
  },
  { _id: false }
);

// Same physical upper bound whatever the unit.
customPaperSizeSchema.pre('validate', function checkMaxSize() {
  const factor = DIMENSION_UNITS[this.unit] ?? 1;
  for (const field of ['width', 'height']) {
    if (this[field] * factor > MAX_DIMENSION_MM) {
      this.invalidate(field, `${field === 'width' ? 'Width' : 'Height'} cannot exceed ${+(MAX_DIMENSION_MM / factor).toFixed(1)} ${this.unit}`);
    }
  }
});

const taskSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    // The business date of the print job (e.g. due/delivery date).
    // Not the same as createdAt, which records when the document was inserted.
    taskDate: {
      type: Date,
      required: [true, 'Task date is required'],
    },
    paperType: {
      type: String,
      required: [true, 'Paper type is required'],
      trim: true,
      enum: {
        // Legacy values stay valid so existing documents can still be saved.
        values: [...PAPER_TYPES, ...LEGACY_PAPER_TYPES],
        message: `Paper type must be one of: ${PAPER_TYPES.join(', ')}`,
      },
    },
    paperSize: {
      type: String,
      required: [true, 'Paper size is required'],
      trim: true,
      enum: {
        values: [...PAPER_SIZES, ...LEGACY_PAPER_SIZES],
        message: `Paper size must be one of: ${PAPER_SIZES.join(', ')}`,
      },
    },
    // Grams per square meter. Required for new tasks by the API; not required by
    // the schema so tasks created before this field existed remain valid.
    paperWeight: {
      type: Number,
      enum: {
        values: PAPER_WEIGHTS,
        message: `Paper weight must be one of: ${PAPER_WEIGHTS.join(', ')}`,
      },
    },
    customPaperSize: {
      type: customPaperSizeSchema,
      default: undefined,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      max: [1_000_000_000, 'Price is too large'],
    },
    // Set explicitly by users; never derived from dates. Older documents without
    // this field read back as "pending" thanks to the default.
    status: {
      type: String,
      enum: {
        values: TASK_STATUSES,
        message: `Status must be one of: ${TASK_STATUSES.join(', ')}`,
      },
      default: DEFAULT_TASK_STATUS,
    },
  },
  {
    // createdAt / updatedAt are managed by Mongoose; createdAt is immutable.
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.status ??= DEFAULT_TASK_STATUS;
        if (ret.customPaperSize) ret.customPaperSize.unit ??= DEFAULT_DIMENSION_UNIT;
        return ret;
      },
    },
  }
);

taskSchema.index({ taskDate: -1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ paperType: 1, paperSize: 1 });
taskSchema.index({ paperWeight: 1 });
taskSchema.index({ status: 1 });

export const Task = mongoose.model('Task', taskSchema);
