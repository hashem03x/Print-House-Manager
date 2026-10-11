import { env } from '../config/env.js';
import {
  CUSTOM_PAPER_SIZE,
  DEFAULT_DIMENSION_UNIT,
  LEGACY_PAPER_SIZES,
  LEGACY_PAPER_TYPES,
  PAPER_SIZES,
  PAPER_TYPES,
  PAPER_WEIGHTS,
  TASK_STATUSES,
} from '../constants/paperOptions.js';
import { checkPaperSizeConsistency } from '../middleware/validateTask.js';
import { Task } from '../models/Task.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { startOfDayInTimeZone } from '../utils/dates.js';

// Explicit allowlist: only these fields can be used for sorting.
const SORTABLE_FIELDS = ['taskDate', 'createdAt', 'updatedAt', 'price', 'description'];
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const LATEST_TASKS_LIMIT = 5;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : NaN;
}

/** Turns query parameters into a validated MongoDB filter, sort and pagination. */
function parseListQuery(query) {
  const errors = {};
  const single = (value) => (Array.isArray(value) ? value[0] : value);

  const page = parsePositiveInt(single(query.page), 1);
  const limit = parsePositiveInt(single(query.limit), DEFAULT_LIMIT);
  if (Number.isNaN(page)) errors.page = 'page must be a positive integer';
  if (Number.isNaN(limit)) errors.limit = 'limit must be a positive integer';

  const filter = {};

  const search = single(query.search)?.trim();
  if (search) filter.description = { $regex: escapeRegex(search), $options: 'i' };

  const paperType = single(query.paperType)?.trim();
  if (paperType) {
    // Legacy values remain filterable so older tasks can still be found.
    if (PAPER_TYPES.includes(paperType) || LEGACY_PAPER_TYPES.includes(paperType)) filter.paperType = paperType;
    else errors.paperType = `paperType must be one of: ${PAPER_TYPES.join(', ')}`;
  }

  const paperSize = single(query.paperSize)?.trim();
  if (paperSize) {
    if (PAPER_SIZES.includes(paperSize) || LEGACY_PAPER_SIZES.includes(paperSize)) filter.paperSize = paperSize;
    else errors.paperSize = `paperSize must be one of: ${PAPER_SIZES.join(', ')}`;
  }

  const paperWeight = single(query.paperWeight)?.trim();
  if (paperWeight) {
    const weight = Number(paperWeight);
    if (PAPER_WEIGHTS.includes(weight)) filter.paperWeight = weight;
    else errors.paperWeight = `paperWeight must be one of: ${PAPER_WEIGHTS.join(', ')}`;
  }

  const status = single(query.status)?.trim();
  if (status) {
    if (!TASK_STATUSES.includes(status)) errors.status = `status must be one of: ${TASK_STATUSES.join(', ')}`;
    // Older documents without a status count as pending.
    else filter.status = status === 'pending' ? { $ne: 'completed' } : 'completed';
  }

  const sortBy = single(query.sortBy)?.trim() || 'createdAt';
  if (!SORTABLE_FIELDS.includes(sortBy)) {
    errors.sortBy = `sortBy must be one of: ${SORTABLE_FIELDS.join(', ')}`;
  }

  const order = (single(query.order)?.trim() || 'desc').toLowerCase();
  if (order !== 'asc' && order !== 'desc') errors.order = 'order must be "asc" or "desc"';

  if (Object.keys(errors).length > 0) {
    throw ApiError.badRequest('Invalid query parameters', errors);
  }

  return {
    filter,
    // _id as a tie-breaker keeps pagination stable when sort values are equal
    sort: { [sortBy]: order === 'asc' ? 1 : -1, _id: order === 'asc' ? 1 : -1 },
    page,
    limit: Math.min(limit, MAX_LIMIT),
  };
}

// GET /api/tasks
export async function getTasks(req, res) {
  const { filter, sort, page, limit } = parseListQuery(req.query);

  const [tasks, total] = await Promise.all([
    Task.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  sendSuccess(res, {
    data: {
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
    message: 'Tasks retrieved successfully',
  });
}

// GET /api/tasks/stats
// All figures are computed by the database; nothing is taken from the client.
export async function getTaskStats(_req, res) {
  const todayStart = startOfDayInTimeZone(new Date(), env.timeZone);

  const [totals, tasksToday, latestTasks] = await Promise.all([
    Task.aggregate([
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          totalValue: { $sum: '$price' },
          completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        },
      },
    ]),
    Task.countDocuments({ createdAt: { $gte: todayStart } }),
    Task.find().sort({ createdAt: -1, _id: -1 }).limit(LATEST_TASKS_LIMIT),
  ]);

  const totalTasks = totals[0]?.totalTasks ?? 0;
  const completedTasks = totals[0]?.completedTasks ?? 0;

  sendSuccess(res, {
    data: {
      totalTasks,
      completedTasks,
      // Anything not explicitly completed (including legacy documents) is pending.
      pendingTasks: totalTasks - completedTasks,
      tasksToday,
      // Round away floating-point noise from summing decimals.
      totalValue: Math.round((totals[0]?.totalValue ?? 0) * 100) / 100,
      latestTasks,
      timeZone: env.timeZone,
      todayStart: todayStart.toISOString(),
    },
    message: 'Task statistics retrieved successfully',
  });
}

// GET /api/tasks/:id
export async function getTaskById(req, res) {
  const task = await Task.findById(req.params.id);
  if (!task) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');

  sendSuccess(res, { data: task, message: 'Task retrieved successfully' });
}

// POST /api/tasks
export async function createTask(req, res) {
  const task = await Task.create(req.taskData);

  sendSuccess(res, { statusCode: 201, data: task, message: 'Task created successfully' });
}

// PUT /api/tasks/:id
export async function updateTask(req, res) {
  const task = await Task.findById(req.params.id);
  if (!task) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');

  // req.taskData contains only whitelisted fields, so createdAt can never be overwritten.
  const { customPaperSize, ...changes } = req.taskData;

  // A retired paper type/size may be kept (sent back unchanged) but not newly chosen.
  const legacyErrors = {};
  for (const field of req.legacyFields ?? []) {
    if (changes[field] !== task[field]) {
      legacyErrors[field] = `"${changes[field]}" is no longer available; choose one of the current options`;
    }
  }
  if (Object.keys(legacyErrors).length > 0) throw ApiError.badRequest('Validation failed', legacyErrors);
  const finalSize = changes.paperSize ?? task.paperSize;

  // Resolve dimensions against the stored task: keep saved ones when the size stays
  // custom, and always clear them when the size is (or becomes) a predefined one.
  let finalDimensions;
  if (finalSize === CUSTOM_PAPER_SIZE) {
    const stored = task.customPaperSize?.toObject();
    // Legacy custom sizes saved without a unit keep being interpreted as millimeters.
    finalDimensions =
      customPaperSize === undefined ? stored && { unit: DEFAULT_DIMENSION_UNIT, ...stored } : customPaperSize;
  } else {
    finalDimensions = customPaperSize ?? undefined;
  }

  const consistencyErrors = checkPaperSizeConsistency(finalSize, finalDimensions);
  if (Object.keys(consistencyErrors).length > 0) {
    throw ApiError.badRequest('Validation failed', consistencyErrors);
  }

  task.set(changes);
  task.customPaperSize = finalSize === CUSTOM_PAPER_SIZE ? finalDimensions : undefined;
  await task.save();

  sendSuccess(res, { data: task, message: 'Task updated successfully' });
}

// PATCH /api/tasks/:id/status
export async function updateTaskStatus(req, res) {
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: { status: req.taskStatus } },
    { returnDocument: 'after', runValidators: true }
  );
  if (!task) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');

  sendSuccess(res, { data: task, message: 'Task status updated successfully' });
}

// DELETE /api/tasks/:id
export async function deleteTask(req, res) {
  const task = await Task.findByIdAndDelete(req.params.id);
  if (!task) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');

  sendSuccess(res, { data: { id: task.id }, message: 'Task deleted successfully' });
}
