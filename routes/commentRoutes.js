const express = require('express');
const router = express.Router();
const { deleteComment } = require('../controllers/commentController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.delete('/:id', deleteComment);

module.exports = router;
