const Comment = require('../models/Comment');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification');

/**
 * @desc    Get comments for a task
 * @route   GET /api/tasks/:taskId/comments
 * @access  Private (project members only)
 */
const getTaskComments = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId).populate('project', 'members');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const isMember = task.project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const comments = await Comment.find({ task: req.params.taskId })
      .populate('user', 'name username profileImage')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, data: { comments } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add comment to a task
 * @route   POST /api/tasks/:taskId/comments
 * @access  Private (project members only)
 */
const addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required.' });
    }

    const task = await Task.findById(req.params.taskId).populate('project', 'members name');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const isMember = task.project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const comment = await Comment.create({
      task: req.params.taskId,
      user: req.user._id,
      text: text.trim()
    });

    const populated = await Comment.findById(comment._id)
      .populate('user', 'name username profileImage');

    const io = req.app.get('io');

    // Notify task assignee if someone else commented
    if (task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        recipient: task.assignedTo,
        sender: req.user._id,
        type: 'comment_added',
        message: `${req.user.name} commented on "${task.title}"`,
        project: task.project._id,
        task: task._id
      });

      if (io) {
        io.to(`user_${task.assignedTo}`).emit('notificationCreated', notification);
      }
    }

    // Also notify task creator if different from commenter and assignee
    if (
      task.createdBy &&
      task.createdBy.toString() !== req.user._id.toString() &&
      (!task.assignedTo || task.assignedTo.toString() !== task.createdBy.toString())
    ) {
      const notification = await Notification.create({
        recipient: task.createdBy,
        sender: req.user._id,
        type: 'comment_added',
        message: `${req.user.name} commented on "${task.title}"`,
        project: task.project._id,
        task: task._id
      });

      if (io) {
        io.to(`user_${task.createdBy}`).emit('notificationCreated', notification);
      }
    }

    // Emit real-time comment to project room
    if (io) {
      io.to(`project_${task.project._id}`).emit('commentAdded', {
        taskId: task._id,
        comment: populated
      });
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully.',
      data: { comment: populated }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete comment
 * @route   DELETE /api/comments/:id
 * @access  Private (comment owner or project owner)
 */
const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id)
      .populate({
        path: 'task',
        populate: { path: 'project' }
      });

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }

    const isCommentOwner = comment.user.toString() === req.user._id.toString();
    const isProjectOwner = comment.task?.project?.owner?.toString() === req.user._id.toString();

    if (!isCommentOwner && !isProjectOwner) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own comments.'
      });
    }

    const taskId = comment.task?._id;
    const projectId = comment.task?.project?._id;

    await Comment.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    if (io && projectId) {
      io.to(`project_${projectId}`).emit('commentDeleted', {
        taskId,
        commentId: req.params.id
      });
    }

    res.status(200).json({ success: true, message: 'Comment deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTaskComments, addComment, deleteComment };
