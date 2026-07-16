const { sendPasswordResetEmail, sendVerificationEmail } = require('../config/email');
const User = require('../models/user.model');
const generateToken = require('../utils/generateToken');
const crypto = require('crypto');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                message: 'User already exists'
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password
        });

        if (user) {
            // Generate verification token
            const verificationToken = crypto.randomBytes(20).toString('hex');
            user.emailVerificationToken = crypto
                .createHash('sha256')
                .update(verificationToken)
                .digest('hex');
            user.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
            await user.save();

            // Send email
            try {
                await sendVerificationEmail(user, verificationToken);
            } catch (error) {
                console.error('Verification email error:', error);
            }

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id),
                isEmailVerfied: user.isEmailVerfied,
            });
        }

    } catch (error) {
        console.error('Registration error:', error.message);
        res.status(400).json({
            message: error.message
        });
    }
};


// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        // Check if account is locked
        if (user.isLocked()) {
            const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
            return res.status(401).json({
                message: `Account is locked. Please try again in ${lockTime} minutes.`
            });
        }
        
        // Check password
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            user.loginAttempts += 1;

            if (user.loginAttempts >= 5) {
                user.lockUntil = Date.now() + 30 * 60 * 1000;
                await user.save();
                return res.status(401).json({
                    message: `Account locked due to multiple failed attempts. Try again in 30 minutes`
                });
            }

            await user.save();
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        // Reset login attempst on successful login
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLogin = Date.now();
        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id),
            isEmailVerfied: user.isEmailVerfied,
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(400).json({
            message: error.message
        });
    }
};


// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
        await user.save();

        // Send email
        try {
            await sendPasswordResetEmail(user, resetToken);
            res.json({ message: 'Password reset email sent' });
        } catch (error) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save();
            res.status(500).json({
                message: 'Email could not be sent'
            });
        };

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};


// @desc    Reset Password
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
const resetPassword = async (req, res) => {
    try {
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resetToken)
            .digest('hex');

        const user = await User.findOne({ 
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
         });

         if (!user) {
            return res.status(400).json({
                message: 'Invalid or expired reset token'
            });
         }

         // Set new password
         user.password = req.body.password;
         user.resetPasswordToken = undefined;
         user.resetPasswordExpire = undefined;
         await user.save();

         res.json({
            message: 'Password reset successful'
         });
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};


// @desc    Verify email
// @route   GET /api/auth/verify-email/:verificationToken
// @access  Public
const verifyEmail = async (req, res) => {
    try {
        const verificationToken = crypto
            .createHash('sha256')
            .update(req.params.verificationToken)
            .digest('hex');

        const user = await User.findOne({
            emailVerificationToken: verificationToken,
            emailVerificationToken: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                message: 'Invalid or expired verification token'
            });
        }

        user.isEmailVerfied = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;
        await user.save();

        res.json({
            message: 'Email verified successfully'
        });

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};


// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerficationEmail = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        if (user.isEmailVerfied) {
            return res.status(400).json({
                message: 'Email already verified'
            });
        }

        const verificationToken = crypto.randomBytes(20).toString('hex');
        user.emailVerificationToken = crypto
            .createHash('sha256')
            .update(verificationToken)
            .digest('hex')
        user.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
        await user.save();

        await sendVerificationEmail(user, verificationToken);
        res.json({
            message: 'Verification email sent'
        });

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};


// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email
        });
    } catch (error) {
        console.error('Get user error:', error.message);
        res.status(400).json({
            message: error.message
        });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
    res.json({
        message: 'Logged out successfully'
    });
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
    logoutUser,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerficationEmail,
};