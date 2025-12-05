/**
 * Error Handler Middleware
 */

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // SQL Server errors
    if (err.name === 'ConnectionError') {
        return res.status(503).json({
            success: false,
            message: 'Không thể kết nối database',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    if (err.name === 'RequestError') {
        return res.status(400).json({
            success: false,
            message: 'Lỗi truy vấn database',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token không hợp lệ'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token đã hết hạn'
        });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Dữ liệu không hợp lệ',
            errors: err.errors
        });
    }

    // Default error
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Lỗi server',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

/**
 * Not Found handler
 */
const notFound = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Không tìm thấy route: ${req.originalUrl}`
    });
};

module.exports = {
    errorHandler,
    notFound
};
