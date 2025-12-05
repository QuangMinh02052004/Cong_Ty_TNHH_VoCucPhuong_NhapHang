/**
 * Stations Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { verifyToken } = require('../middleware/auth');

/**
 * @route   GET /api/stations
 * @desc    Get all stations
 * @access  Private
 */
router.get('/', verifyToken, async (req, res, next) => {
    try {
        const stations = await query(`
            SELECT * FROM Stations
            WHERE isActive = 1
            ORDER BY code
        `);

        res.json({
            success: true,
            count: stations.length,
            stations
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
