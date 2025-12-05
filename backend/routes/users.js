/**
 * Users Routes
 */

const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../config/database');
const { verifyToken, isAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (Admin only)
 */
router.get('/', verifyToken, isAdmin, async (req, res, next) => {
    try {
        const users = await query(`
            SELECT id, username, fullName, role, station, active, createdAt, updatedAt
            FROM Users
            ORDER BY role DESC, username
        `);

        res.json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (Admin only)
 */
router.get('/:id', verifyToken, isAdmin, async (req, res, next) => {
    try {
        const user = await queryOne(
            'SELECT id, username, fullName, role, station, active, createdAt FROM Users WHERE id = @id',
            { id: req.params.id }
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
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (Admin only)
 */
router.post('/', verifyToken, isAdmin, async (req, res, next) => {
    try {
        const { id, username, password, fullName, role, station } = req.body;

        // Validate
        if (!id || !username || !password || !fullName || !role) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin!'
            });
        }

        // Check if username exists
        const existing = await queryOne('SELECT id FROM Users WHERE username = @username', { username });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Username đã tồn tại!'
            });
        }

        // Create user
        await query(`
            INSERT INTO Users (id, username, password, fullName, role, station, active)
            VALUES (@id, @username, @password, @fullName, @role, @station, 1)
        `, { id, username, password, fullName, role, station: station || null });

        res.status(201).json({
            success: true,
            message: 'Tạo user thành công!'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin only)
 */
router.put('/:id', verifyToken, isAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { fullName, role, station, active } = req.body;

        const user = await queryOne('SELECT id FROM Users WHERE id = @id', { id });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy user!'
            });
        }

        await query(`
            UPDATE Users
            SET fullName = COALESCE(@fullName, fullName),
                role = COALESCE(@role, role),
                station = COALESCE(@station, station),
                active = COALESCE(@active, active),
                updatedAt = GETDATE()
            WHERE id = @id
        `, { id, fullName, role, station, active });

        res.json({
            success: true,
            message: 'Cập nhật user thành công!'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Admin only)
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        const user = await queryOne('SELECT id FROM Users WHERE id = @id', { id });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy user!'
            });
        }

        await query('DELETE FROM Users WHERE id = @id', { id });

        res.json({
            success: true,
            message: 'Xóa user thành công!'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
