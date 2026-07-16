const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    logoutUser
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middlerware');

router.post('/register', registerUser);
router.post('/login', loginUser),
router.get('/me', protect, getMe);
router.post('/logout', protect, logoutUser);


module.exports = router;