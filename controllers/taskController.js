const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const Comment = require('../models/Comment');

/**
 * Helper: Verify user is project member
 */
const verifyMember = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return { project: null, isMember: false };
  const member = project.members.some(m => m.user.toString() === userId.toString());
  return { project, isMember: member };
};

/**
 * @desc    Get all tasks for a project
 * @route   GET /api/projects/:projectId/tasks
 * @access  Private (members only)
 */
const getProjectTasks = async (req, res, next) => {
  try {
    const { project, isMember } = await verifyMember(req.params.projectId, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    if (!isMember) return res.status(403).json({ success: false, message: 'Access denied.' });

    const { status, priority, assignedTo, search } = req.query;
    let query = { project: req.params.projectId };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name username profileImage')
      .populate('createdBy', 'name username profileImage')
      .sort({ position: 1, createdAt: 1 });

    // Add comment counts
    const tasksWithCounts = await Promise.all(
      tasks.map(async (task) => {
        const commentCount = await Comment.countDocuments({ task: task._id });
        return { ...task.toObject(), commentCount };
      })
    );

    res.status(200).json({ success: true, data: { tasks: tasksWithCounts } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single task
 * @route   GET /api/tasks/:id
 * @access  Private (members only)
 */
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name username profileImage')
      .populate('createdBy', 'name username profileImage')
      .populate('project', 'name members');

    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    // Check project membership
    const isMemberCheck = task.project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (!isMemberCheck) return res.status(403).json({ success: false, message: 'Access denied.' });

    const commentCount = await Comment.countDocuments({ task: task._id });

    res.status(200).json({
      success: true,
      data: { task: { ...task.toObject(), commentCount } }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create task
 * @route   POST /api/projects/:projectId/tasks
 * @access  Private (members only)
 */
const createTask = async (req, res, next) => {
  try {
    const { project, isMember } = await verifyMember(req.params.projectId, req.user._id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    if (!isMember) return res.status(403).json({ success: false, message: 'Access denied.' });

    const { title, description, assignedTo, priority, status, dueDate } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Task title is required.' });

    // Validate assigned user is a project member
    if (assignedTo) {
      const assignedIsMember = project.members.some(m => m.user.toString() === assignedTo.toString());
      if (!assignedIsMember) {
        return res.status(400).json({ success: false, message: 'Assigned user is not a project member.' });
      }
    }

    // Get max position for the status column
    const maxPositionTask = await Task.findOne({ project: req.params.projectId, status: status || 'todo' })
      .sort({ position: -1 });
    const position = maxPositionTask ? maxPositionTask.position + 1 : 0;

    const task = await Task.create({
      project: req.params.projectId,
      title: title.trim(),
      description: description?.trim() || '',
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
      priority: priority || 'medium',
      status: status || 'todo',
      dueDate: dueDate || null,
      position
    });

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name username profileImage')
      .populate('createdBy', 'name username profileImage');

    // Notify assigned user
    const io = req.app.get('io');
    if (assignedTo && assignedTo.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        recipient: assignedTo,
        sender: req.user._id,
        type: 'task_assigned',
        message: `${req.user.name} assigned you a new task: "${title}"`,
        project: req.params.projectId,
        task: task._id
      });

      if (io) {
        io.to(`user_${assignedTo}`).emit('notificationCreated', notification);
      }
    }

    if (io) {
      io.to(`project_${req.params.projectId}`).emit('taskCreated', {
        task: { ...populated.toObject(), commentCount: 0 }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully.',
      data: { task: { ...populated.toObject(), commentCount: 0 } }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update task
 * @route   PUT /api/tasks/:id
 * @access  Private (members only)
 */
const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('project', 'members owner');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const isMemberCheck = task.project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (!isMemberCheck) return res.status(403).json({ success: false, message: 'Access denied.' });

    const { title, description, assignedTo, priority, status, dueDate } = req.body;
    const previousAssigned = task.assignedTo?.toString();
    const previousStatus = task.status;
    const updateData = {};

    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (priority) updateData.priority = priority;
    if (status) updateData.status = status;
    if (dueDate !== undefined) updateData.dueDate = dueDate || null;

    if (assignedTo !== undefined) {
      if (assignedTo) {
        const isProjectMember = task.project.members.some(m => m.user.toString() === assignedTo.toString());
        if (!isProjectMember) {
          return res.status(400).json({ success: false, message: 'Assigned user is not a project member.' });
        }
      }
      updateData.assignedTo = assignedTo || null;
    }

    const updated = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
      .populate('assignedTo', 'name username profileImage')
      .populate('createdBy', 'name username profileImage');

    const commentCount = await Comment.countDocuments({ task: updated._id });
    const taskData = { ...updated.toObject(), commentCount };

    const io = req.app.get('io');

    // Notify if task reassigned
    if (assignedTo && assignedTo.toString() !== previousAssigned) {
      if (assignedTo.toString() !== req.user._id.toString()) {
        const notification = await Notification.create({
          recipient: assignedTo,
          sender: req.user._id,
          type: 'task_assigned',
          message: `${req.user.name} assigned you task: "${updated.title}"`,
          project: task.project._id,
          task: task._id
        });
        if (io) io.to(`user_${assignedTo}`).emit('notificationCreated', notification);
      }
    }

    // Notify if status changed
    if (status && status !== previousStatus && previousAssigned && previousAssigned !== req.user._id.toString()) {
      const notification = await Notification.create({
        recipient: previousAssigned,
        sender: req.user._id,
        type: 'task_status_changed',
        message: `Task "${updated.title}" status changed to ${status}`,
        project: task.project._id,
        task: task._id
      });
      if (io) io.to(`user_${previousAssigned}`).emit('notificationCreated', notification);
    }

    if (io) {
      io.to(`project_${task.project._id}`).emit('taskUpdated', { task: taskData });
    }

    res.status(200).json({
      success: true,
      message: 'Task updated successfully.',
      data: { task: taskData }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete task
 * @route   DELETE /api/tasks/:id
 * @access  Private (members only)
 */
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('project', 'members owner');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const isMemberCheck = task.project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (!isMemberCheck) return res.status(403).json({ success: false, message: 'Access denied.' });

    await Comment.deleteMany({ task: task._id });
    await Task.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`project_${task.project._id}`).emit('taskDeleted', {
        taskId: req.params.id,
        projectId: task.project._id
      });
    }

    res.status(200).json({ success: true, message: 'Task deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update task status (for drag-and-drop)
 * @route   PUT /api/tasks/:id/status
 * @access  Private (members only)
 */
const updateTaskStatus = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('project', 'members');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const isMemberCheck = task.project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (!isMemberCheck) return res.status(403).json({ success: false, message: 'Access denied.' });

    const { status, position } = req.body;
    const validStatuses = ['todo', 'in-progress', 'in-review', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const previousStatus = task.status;
    task.status = status;
    if (position !== undefined) task.position = position;
    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name username profileImage')
      .populate('createdBy', 'name username profileImage');

    const commentCount = await Comment.countDocuments({ task: task._id });
    const taskData = { ...populated.toObject(), commentCount };

    // Notify assigned user of status change
    const io = req.app.get('io');
    if (task.assignedTo && task.assignedTo.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        recipient: task.assignedTo,
        sender: req.user._id,
        type: 'task_status_changed',
        message: `Task "${task.title}" moved from ${previousStatus} to ${status}`,
        project: task.project._id,
        task: task._id
      });
      if (io) io.to(`user_${task.assignedTo}`).emit('notificationCreated', notification);
    }

    if (io) {
      io.to(`project_${task.project._id}`).emit('taskMoved', {
        task: taskData,
        previousStatus
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task status updated.',
      data: { task: taskData }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Assign task to user
 * @route   PUT /api/tasks/:id/assign
 * @access  Private (members only)
 */
const assignTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('project', 'members');
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const isMemberCheck = task.project.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (!isMemberCheck) return res.status(403).json({ success: false, message: 'Access denied.' });

    const { userId } = req.body;
    if (userId) {
      const isProjectMember = task.project.members.some(m => m.user.toString() === userId.toString());
      if (!isProjectMember) {
        return res.status(400).json({ success: false, message: 'User is not a project member.' });
      }
    }

    task.assignedTo = userId || null;
    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name username profileImage')
      .populate('createdBy', 'name username profileImage');

    const commentCount = await Comment.countDocuments({ task: task._id });
    const taskData = { ...populated.toObject(), commentCount };

    // Notify assigned user
    const io = req.app.get('io');
    if (userId && userId.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        recipient: userId,
        sender: req.user._id,
        type: 'task_assigned',
        message: `${req.user.name} assigned you task: "${task.title}"`,
        project: task.project._id,
        task: task._id
      });
      if (io) io.to(`user_${userId}`).emit('notificationCreated', notification);
    }

    if (io) {
      io.to(`project_${task.project._id}`).emit('taskAssigned', { task: taskData });
    }

    res.status(200).json({
      success: true,
      message: 'Task assigned successfully.',
      data: { task: taskData }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all tasks accessible by current user across projects
 * @route   GET /api/tasks
 * @access  Private
 */
const getAllUserTasks = async (req, res, next) => {
  try {
    const userProjects = await Project.find({ 'members.user': req.user._id }).select('_id');
    const projectIds = userProjects.map(p => p._id);

    const { status, priority, assignedTo, search, filter } = req.query;
    let query = { project: { $in: projectIds } };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) {
      if (assignedTo === 'me') {
        query.assignedTo = req.user._id;
      } else {
        query.assignedTo = assignedTo;
      }
    }
    if (filter === 'assigned') {
      query.assignedTo = req.user._id;
    } else if (filter === 'created') {
      query.createdBy = req.user._id;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('project', 'name color')
      .populate('assignedTo', 'name username profileImage')
      .populate('createdBy', 'name username profileImage')
      .sort({ updatedAt: -1 });

    const tasksWithCounts = await Promise.all(
      tasks.map(async (task) => {
        const commentCount = await Comment.countDocuments({ task: task._id });
        return { ...task.toObject(), commentCount };
      })
    );

    res.status(200).json({ success: true, data: { tasks: tasksWithCounts } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUserTasks,
  getProjectTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  assignTask
};

