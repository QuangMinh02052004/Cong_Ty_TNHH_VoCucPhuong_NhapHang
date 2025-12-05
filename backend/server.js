/**
 * Main Server File
 * Backend API cho Hệ Thống Quản Lý Hàng Hóa - Võ Cúc Phương
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { getPool } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const usersRoutes = require('./routes/users');
const stationsRoutes = require('./routes/stations');

// Initialize app
const app = express();
const PORT = process.env.PORT || 5001;

// =============================================
// MIDDLEWARE
// =============================================

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging (development)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

// =============================================
// ROUTES
// =============================================

// Health check
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Hệ Thống Quản Lý Hàng Hóa - Võ Cúc Phương API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            products: '/api/products',
            users: '/api/users',
            stations: '/api/stations'
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        message: 'Server đang chạy',
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stations', stationsRoutes);

// =============================================
// ERROR HANDLING
// =============================================

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// =============================================
// START SERVER
// =============================================

const startServer = async () => {
    try {
        // Test database connection
        await getPool();
        console.log('✅ Kết nối database thành công!');

        // Start server
        app.listen(PORT, () => {
            console.log('');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(`🚀 Server đang chạy trên port ${PORT}`);
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('');
            console.log('📋 API Endpoints:');
            console.log(`   • POST   /api/auth/login         - Đăng nhập`);
            console.log(`   • GET    /api/auth/me            - Thông tin user`);
            console.log(`   • GET    /api/products           - Danh sách hàng hóa`);
            console.log(`   • POST   /api/products           - Tạo đơn hàng mới`);
            console.log(`   • PUT    /api/products/:id       - Cập nhật đơn hàng`);
            console.log(`   • DELETE /api/products/:id       - Xóa đơn hàng`);
            console.log(`   • GET    /api/users              - Danh sách users (admin)`);
            console.log(`   • GET    /api/stations           - Danh sách trạm`);
            console.log('');
            console.log('✅ Server sẵn sàng nhận requests!');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('');
        });
    } catch (error) {
        console.error('');
        console.error('❌ LỖI KHỞI ĐỘNG SERVER:');
        console.error(error.message);
        console.error('');
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⏳ Đang shutdown server...');
    const { closePool } = require('./config/database');
    await closePool();
    console.log('👋 Server đã tắt');
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
