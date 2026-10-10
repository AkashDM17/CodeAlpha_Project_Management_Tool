const Project = require('../models/Project');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Helper: Check if user is a project member
 */
const isMember = (project, userId) => {
  if (!project || !project.members) return false;
  return project.members.some(m => {
    const memberId = m.user?._id ? m.user._id.toString() : m.user?.toString();
    return memberId === userId.toString();
  });
};

/**
 * Helper: Check if user is project owner
 */
const isOwner = (project, userId) => {
  if (!project || !project.owner) return false;
  const ownerId = project.owner?._id ? project.owner._id.toString() : project.owner?.toString();
  return ownerId === userId.toString();
};

/**
 * @desc    Get all projects for current user
 * @route   GET /api/projects
 * @access  Private
 */
const getProjects = async (req, res, next) => {
  try {
    const { search } = req.query;
    let matchQuery = { 'members.user': req.user._id };

    if (search) {
      matchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const projects = await Project.find(matchQuery)
      .populate('owner', 'name username profileImage')
      .populate('members.user', 'name username profileImage')
      .sort({ updatedAt: -1 });

    // Add task stats
    const projectsWithStats = await Promise.all(
      projects.map(async (proj) => {
        const totalTasks = await Task.countDocuments({ project: proj._id });
        const completedTasks = await Task.countDocuments({ project: proj._id, status: 'completed' });
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        return { ...proj.toObject(), totalTasks, completedTasks, progress };
      })
    );

    res.status(200).json({ success: true, data: { projects: projectsWithStats } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single project
 * @route   GET /api/projects/:id
 * @access  Private (members only)
 */
const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name username profileImage email')
      .populate('members.user', 'name username profileImage email');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (!isMember(project, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied. You are not a member of this project.' });
    }

    const totalTasks = await Task.countDocuments({ project: project._id });
    const completedTasks = await Task.countDocuments({ project: project._id, status: 'completed' });
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.status(200).json({
      success: true,
      data: { project: { ...project.toObject(), totalTasks, completedTasks, progress } }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new project
 * @route   POST /api/projects
 * @access  Private
 */
const createProject = async (req, res, next) => {
  try {
    const { name, description, startDate, dueDate, memberIds, color } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Project name is required.' });
    }

    // Build members array – owner is always added first
    const members = [{ user: req.user._id, role: 'owner' }];

    if (memberIds && Array.isArray(memberIds)) {
      for (const uid of memberIds) {
        if (uid.toString() !== req.user._id.toString()) {
          const userExists = await User.findById(uid);
          if (userExists) {
            members.push({ user: uid, role: 'member' });
          }
        }
      }
    }

    const project = await Project.create({
      name: name.trim(),
      description: description?.trim() || '',
      owner: req.user._id,
      members,
      startDate: startDate || null,
      dueDate: dueDate || null,
      color: color || '#6366f1'
    });

    const populated = await Project.findById(project._id)
      .populate('owner', 'name username profileImage')
      .populate('members.user', 'name username profileImage');

    // Notify added members
    const io = req.app.get('io');
    for (const member of members) {
      if (member.user.toString() !== req.user._id.toString()) {
        const notification = await Notification.create({
          recipient: member.user,
          sender: req.user._id,
          type: 'member_added',
          message: `${req.user.name} added you to project "${name}"`,
          project: project._id
        });

        if (io) {
          io.to(`user_${member.user}`).emit('notificationCreated', notification);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      data: { project: populated }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update project
 * @route   PUT /api/projects/:id
 * @access  Private (owner only)
 */
const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (!isOwner(project, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the project owner can update the project.' });
    }

    const { name, description, startDate, dueDate, status, color } = req.body;
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (startDate !== undefined) updateData.startDate = startDate;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (status) updateData.status = status;
    if (color) updateData.color = color;

    const updated = await Project.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    })
      .populate('owner', 'name username profileImage')
      .populate('members.user', 'name username profileImage');

    const io = req.app.get('io');
    if (io) {
      io.to(`project_${req.params.id}`).emit('projectUpdated', { project: updated });
    }

    res.status(200).json({
      success: true,
      message: 'Project updated successfully.',
      data: { project: updated }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete project
 * @route   DELETE /api/projects/:id
 * @access  Private (owner only)
 */
const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (!isOwner(project, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the project owner can delete the project.' });
    }

    // Delete all tasks and comments associated
    const tasks = await Task.find({ project: req.params.id });
    const taskIds = tasks.map(t => t._id);
    const Comment = require('../models/Comment');
    await Comment.deleteMany({ task: { $in: taskIds } });
    await Task.deleteMany({ project: req.params.id });
    await Notification.deleteMany({ project: req.params.id });
    await Project.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`project_${req.params.id}`).emit('projectDeleted', { projectId: req.params.id });
    }

    res.status(200).json({ success: true, message: 'Project deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add member to project
 * @route   POST /api/projects/:id/members
 * @access  Private (owner only)
 */
const addMember = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (!isOwner(project, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the project owner can add members.' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (isMember(project, userId)) {
      return res.status(400).json({ success: false, message: 'User is already a member.' });
    }

    project.members.push({ user: userId, role: 'member' });
    await project.save();

    const updated = await Project.findById(project._id)
      .populate('owner', 'name username profileImage')
      .populate('members.user', 'name username profileImage');

    // Notify new member
    const notification = await Notification.create({
      recipient: userId,
      sender: req.user._id,
      type: 'member_added',
      message: `${req.user.name} added you to project "${project.name}"`,
      project: project._id
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('notificationCreated', notification);
      io.to(`project_${req.params.id}`).emit('memberAdded', {
        project: updated,
        newMember: { user: userToAdd, role: 'member' }
      });
    }

    res.status(200).json({
      success: true,
      message: `${userToAdd.name} added to project.`,
      data: { project: updated }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove member from project
 * @route   DELETE /api/projects/:id/members/:userId
 * @access  Private (owner only)
 */
const removeMember = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    if (!isOwner(project, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the project owner can remove members.' });
    }

    const { userId } = req.params;

    if (userId === project.owner.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot remove the project owner.' });
    }

    if (!isMember(project, userId)) {
      return res.status(400).json({ success: false, message: 'User is not a member of this project.' });
    }

    project.members = project.members.filter(m => m.user.toString() !== userId);
    await project.save();

    const notification = await Notification.create({
      recipient: userId,
      sender: req.user._id,
      type: 'member_removed',
      message: `${req.user.name} removed you from project "${project.name}"`,
      project: project._id
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('notificationCreated', notification);
      io.to(`project_${req.params.id}`).emit('memberRemoved', { projectId: req.params.id, userId });
    }

    res.status(200).json({ success: true, message: 'Member removed successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProjects, getProject, createProject, updateProject, deleteProject, addMember, removeMember };
