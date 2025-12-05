/**
 * Products Routes
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, sql } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const tonghopService = require('../services/tonghop-service');

/**
 * @route   GET /api/products
 * @desc    Get all products with filters
 * @access  Private
 */
router.get('/', verifyToken, async (req, res, next) => {
    try {
        const {
            station,
            senderStation,
            paymentStatus,
            status,
            dateFrom,
            dateTo,
            search
        } = req.query;

        let sqlQuery = 'SELECT * FROM Products WHERE 1=1';
        const params = {};

        // Apply filters
        if (station) {
            sqlQuery += ' AND station = @station';
            params.station = station;
        }

        if (senderStation) {
            sqlQuery += ' AND senderStation = @senderStation';
            params.senderStation = senderStation;
        }

        if (paymentStatus) {
            sqlQuery += ' AND paymentStatus = @paymentStatus';
            params.paymentStatus = paymentStatus;
        }

        if (status) {
            sqlQuery += ' AND status = @status';
            params.status = status;
        }

        if (dateFrom) {
            sqlQuery += ' AND sendDate >= @dateFrom';
            params.dateFrom = dateFrom;
        }

        if (dateTo) {
            sqlQuery += ' AND sendDate <= @dateTo';
            params.dateTo = dateTo;
        }

        if (search) {
            sqlQuery += ' AND (receiverName LIKE @search OR senderName LIKE @search OR receiverPhone LIKE @search OR senderPhone LIKE @search OR id LIKE @search)';
            params.search = `%${search}%`;
        }

        sqlQuery += ' ORDER BY sendDate DESC';

        const products = await query(sqlQuery, params);

        res.json({
            success: true,
            count: products.length,
            products
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Private
 */
router.get('/:id', verifyToken, async (req, res, next) => {
    try {
        const product = await queryOne(
            'SELECT * FROM Products WHERE id = @id',
            { id: req.params.id }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm!'
            });
        }

        res.json({
            success: true,
            product
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/products
 * @desc    Create new product
 * @access  Private
 */
router.post('/', verifyToken, async (req, res, next) => {
    try {
        let {
            id,
            senderName,
            senderPhone,
            senderStation,
            receiverName,
            receiverPhone,
            station,
            productType,
            quantity,
            vehicle,
            insurance,
            totalAmount,
            paymentStatus,
            notes
        } = req.body;

        // Validate required fields (senderName và senderPhone là optional)
        if (!receiverName || !receiverPhone || !station || !productType) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ thông tin bắt buộc: Người nhận, Điện thoại nhận, Trạm đến, Loại hàng!'
            });
        }

        // Auto-generate ID if not provided
        if (!id) {
            // Sử dụng TRẠM ĐẾN (station) để tạo mã, không phải trạm gửi
            const destinationStation = station;
            const stationCode = destinationStation.split(' - ')[0];

            const now = new Date();
            const year = now.getFullYear().toString().slice(-2);
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const dateKey = `${year}${month}${day}`;

            // Đếm số đơn hàng ĐẾN trạm này trong ngày hôm nay
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const countResult = await queryOne(`
                SELECT COUNT(*) as count
                FROM Products
                WHERE station = @station
                AND sendDate >= @today
                AND sendDate < @tomorrow
            `, {
                station: destinationStation,
                today,
                tomorrow
            });

            const counter = (countResult?.count || 0) + 1;
            const stationCodePadded = stationCode.padStart(2, '0');
            // Không pad counter - chỉ dùng số thứ tự trực tiếp
            id = `${dateKey}.${stationCodePadded}${counter}`;
        }

        // Check if product ID already exists
        const existing = await queryOne('SELECT id FROM Products WHERE id = @id', { id });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Mã hàng đã tồn tại!'
            });
        }

        // Insert product
        await query(`
            INSERT INTO Products (
                id, senderName, senderPhone, senderStation,
                receiverName, receiverPhone, station,
                productType, quantity, vehicle, insurance, totalAmount,
                paymentStatus, employee, createdBy, sendDate, status, notes
            ) VALUES (
                @id, @senderName, @senderPhone, @senderStation,
                @receiverName, @receiverPhone, @station,
                @productType, @quantity, @vehicle, @insurance, @totalAmount,
                @paymentStatus, @employee, @createdBy, @sendDate, @status, @notes
            )
        `, {
            id,
            senderName: senderName || '',
            senderPhone: senderPhone || '',
            senderStation: senderStation || req.user.station,
            receiverName,
            receiverPhone,
            station,
            productType,
            quantity: quantity || null,
            vehicle: vehicle || null,
            insurance: insurance || 0,
            totalAmount: totalAmount || 0,
            paymentStatus: paymentStatus || 'unpaid',
            employee: req.user.fullName,
            createdBy: req.user.fullName,
            sendDate: new Date(),
            status: 'pending',
            notes: notes || null
        });

        // Get created product
        const product = await queryOne('SELECT * FROM Products WHERE id = @id', { id });

        // TongHop Integration: Auto-create booking for "Dọc đường" products
        let warning = null;
        if (tonghopService.isEnabled() && tonghopService.shouldCreateBooking(product)) {
            try {
                const booking = await tonghopService.createBookingForProduct(product);
                console.log(`✅ [TongHop] Created booking ${booking.id} for product ${product.id}`);
            } catch (bookingError) {
                // Product creation still succeeds even if booking fails
                console.error(`❌ [TongHop] Booking failed for product ${product.id}:`, bookingError.message);
                warning = 'Sản phẩm đã tạo thành công nhưng không thể tự động đặt vé xe. Vui lòng tạo booking thủ công trong hệ thống TongHop.';
            }
        }

        res.status(201).json({
            success: true,
            message: 'Tạo đơn hàng thành công!',
            product,
            ...(warning && { warning })
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Private
 */
router.put('/:id', verifyToken, async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Check if product exists
        const existing = await queryOne('SELECT * FROM Products WHERE id = @id', { id });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm!'
            });
        }

        // Build update query
        const allowedFields = [
            'senderName', 'senderPhone', 'senderStation',
            'receiverName', 'receiverPhone', 'station',
            'productType', 'quantity', 'vehicle', 'insurance', 'totalAmount',
            'paymentStatus', 'status', 'notes'
        ];

        const updateFields = [];
        const params = { id };

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                updateFields.push(`${field} = @${field}`);
                params[field] = updates[field];
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không có dữ liệu để cập nhật!'
            });
        }

        // Add updatedAt
        updateFields.push('updatedAt = GETDATE()');

        const sqlQuery = `UPDATE Products SET ${updateFields.join(', ')} WHERE id = @id`;
        await query(sqlQuery, params);

        // Get updated product
        const product = await queryOne('SELECT * FROM Products WHERE id = @id', { id });

        res.json({
            success: true,
            message: 'Cập nhật đơn hàng thành công!',
            product
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product
 * @access  Private
 */
router.delete('/:id', verifyToken, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if product exists
        const existing = await queryOne('SELECT * FROM Products WHERE id = @id', { id });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sản phẩm!'
            });
        }

        // Delete product
        await query('DELETE FROM Products WHERE id = @id', { id });

        res.json({
            success: true,
            message: 'Xóa đơn hàng thành công!'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/products/stats/summary
 * @desc    Get products statistics
 * @access  Private
 */
router.get('/stats/summary', verifyToken, async (req, res, next) => {
    try {
        const stats = await query(`
            SELECT
                COUNT(*) as totalProducts,
                SUM(totalAmount) as totalRevenue,
                SUM(CASE WHEN paymentStatus = 'paid' THEN 1 ELSE 0 END) as paidCount,
                SUM(CASE WHEN paymentStatus = 'unpaid' THEN 1 ELSE 0 END) as unpaidCount,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as deliveredCount
            FROM Products
        `);

        res.json({
            success: true,
            stats: stats[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
