const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware'); // Protección


router.get('/admins', protect, userController.getAdminUsers);
router.put('/:id', protect, userController.updateUser);
router.delete('/:id', protect, userController.deleteUser);
module.exports = router;