/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, queryOne, sql } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

/**
 * @route   POST /api/auth/login
 * @desc    User login
 * @access  Public
 */
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập username và password!'
            });
        }

        // Find user
        const user = await queryOne(
            'SELECT * FROM Users WHERE username = @username AND active = 1',
            { username }
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Username hoặc password không đúng!'
            });
        }

        // Check password (plain text comparison for now, will hash later)
        // TODO: Implement bcrypt comparison after migrating passwords
        if (user.password !== password) {
            return res.status(401).json({
                success: false,
                message: 'Username hoặc password không đúng!'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                station: user.station
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            success: true,
            message: 'Đăng nhập thành công!',
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                station: user.station
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', verifyToken, async (req, res, next) => {
    try {
        const user = await queryOne(
            'SELECT id, username, fullName, role, station, active, createdAt FROM Users WHERE id = @id',
            { id: req.user.id }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy user!'
            });
        }

        res.json({
            success: true,
            user
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    User logout (client-side token removal)
 * @access  Private
 */
router.post('/logout', verifyToken, (req, res) => {
    // JWT is stateless, logout is handled on client side by removing token
    res.json({
        success: true,
        message: 'Đăng xuất thành công!'
    });
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.post('/change-password', verifyToken, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin!'
            });
        }

        // Get current user
        const user = await queryOne(
            'SELECT * FROM Users WHERE id = @id',
            { id: req.user.id }
        );

        // Verify current password
        if (user.password !== currentPassword) {
            return res.status(401).json({
                success: false,
                message: 'Mật khẩu hiện tại không đúng!'
            });
        }

        // Update password
        await query(
            'UPDATE Users SET password = @newPassword, updatedAt = GETDATE() WHERE id = @id',
            { id: req.user.id, newPassword }
        );

        res.json({
            success: true,
            message: 'Đổi mật khẩu thành công!'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
