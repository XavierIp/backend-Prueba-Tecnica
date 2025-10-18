const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', authController.loginUser);
router.post('/register-admin', protect, authController.registerAdmin);
router.post('/register-client', authController.registerClient);
module.exports = router;