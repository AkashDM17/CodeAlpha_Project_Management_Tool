const express = require('express');
const router = express.Router();
const {
  getAllUserTasks,
  getTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  assignTask
} = require('../controllers/taskController');
const {
  getTaskComments,
  addComment
} = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getAllUserTasks);

router.route('/:id')
  .get(getTask)
  .put(updateTask)
  .delete(deleteTask);

router.put('/:id/status', updateTaskStatus);
router.put('/:id/assign', assignTask);

// Comment sub-routes on task
router.route('/:taskId/comments')
  .get(getTaskComments)
  .post(addComment);

module.exports = router;
