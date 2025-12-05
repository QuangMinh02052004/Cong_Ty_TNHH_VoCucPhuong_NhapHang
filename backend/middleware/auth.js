/**
 * Authentication Middleware
 */

const jwt = require('jsonwebtoken');

/**
 * Verify JWT token
 */
const verifyToken = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Không tìm thấy token. Vui lòng đăng nhập!'
            });
        }

        // Verify token
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({
                    success: false,
                    message: 'Token không hợp lệ hoặc đã hết hạn!'
                });
            }

            // Save user info to request
            req.user = decoded;
            next();
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi xác thực',
            error: error.message
        });
    }
};

/**
 * Check if user is admin
 */
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Chỉ admin mới có quyền thực hiện thao tác này!'
        });
    }
    next();
};

/**
 * Check if user is admin or employee
 */
const isAuthenticated = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Vui lòng đăng nhập để tiếp tục!'
        });
    }
    next();
};

module.exports = {
    verifyToken,
    isAdmin,
    isAuthenticated
};
