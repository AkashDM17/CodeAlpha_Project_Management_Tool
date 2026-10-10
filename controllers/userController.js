const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');

/**
 * @desc    Get all users (for search / member invitation)
 * @route   GET /api/users
 * @access  Private
 */
const getUsers = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const users = await User.find(query)
      .select('-password')
      .limit(20)
      .sort({ name: 1 });

    res.status(200).json({ success: true, data: { users } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single user by ID
 * @route   GET /api/users/:id
 * @access  Private
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Get project and task counts
    const projectCount = await Project.countDocuments({
      'members.user': user._id
    });
    const assignedTaskCount = await Task.countDocuments({ assignedTo: user._id });
    const completedTaskCount = await Task.countDocuments({
      assignedTo: user._id,
      status: 'completed'
    });

    res.status(200).json({
      success: true,
      data: { user, stats: { projectCount, assignedTaskCount, completedTaskCount } }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/:id
 * @access  Private
 */
const updateUser = async (req, res, next) => {
  try {
    // Users can only edit their own profile
    if (req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own profile.' });
    }

    const { name, username, bio, profileImage } = req.body;
    const updateData = {};

    if (name) updateData.name = name.trim();
    if (bio !== undefined) updateData.bio = bio.trim();
    if (profileImage !== undefined) updateData.profileImage = profileImage;

    if (username) {
      const existing = await User.findOne({
        username: username.toLowerCase(),
        _id: { $ne: req.params.id }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Username already taken.' });
      }
      updateData.username = username.toLowerCase().trim();
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, getUserById, updateUser };
