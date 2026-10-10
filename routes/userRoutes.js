const express = require('express');
const router = express.Router();
const { getUsers, getUserById, updateUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);

module.exports = router;
