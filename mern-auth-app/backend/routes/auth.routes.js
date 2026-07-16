const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    logoutUser,
    forgotPassword,
    verifyEmail,
    resendVerficationEmail,
    resetPassword
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middlerware');

// Public Routes
router.post('/register', registerUser);
router.post('/login', loginUser),
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resetToken', resetPassword);
router.get('/verify-email/:verificationToken', verifyEmail);
router.post('/resend-verification', resendVerficationEmail);

// Private Routes
router.get('/me', protect, getMe);
router.post('/logout', protect, logoutUser);

module.exports = router;