import { Router } from 'express';
import {
  createTask,
  deleteTask,
  getTaskById,
  getTasks,
  getTaskStats,
  updateTask,
  updateTaskStatus,
} from '../controllers/taskController.js';
import { requireDb } from '../middleware/requireDb.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { validateStatusBody, validateTaskBody } from '../middleware/validateTask.js';

const router = Router();

router.use(requireDb);

router.route('/').get(getTasks).post(validateTaskBody(), createTask);

// Must be registered before "/:id" so "stats" is not treated as an id.
router.get('/stats', getTaskStats);

router
  .route('/:id')
  .all(validateObjectId('id'))
  .get(getTaskById)
  .put(validateTaskBody({ partial: true }), updateTask)
  .delete(deleteTask);

// Dedicated, minimal operation for toggling completion.
router.patch('/:id/status', validateObjectId('id'), validateStatusBody, updateTaskStatus);

export default router;
