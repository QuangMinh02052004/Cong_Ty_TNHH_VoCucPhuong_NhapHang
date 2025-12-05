/**
 * Booking Transformer Service
 *
 * Transforms NhapHang Product data to TongHop Booking format
 */

/**
 * Format note string for booking
 *
 * Formula: "giao {name} {quantity}"
 * Example: "giao Trần Văn A 2 thùng + 2 bao"
 *
 * @param {Object} product - Product object
 * @returns {string} - Formatted note
 */
function formatBookingNote(product) {
    const receiverName = product.receiverName || '';
    const productType = product.productType || '';

    // Priority 1: Use 'quantity' field if provided
    if (product.quantity && product.quantity.trim()) {
        return `giao ${receiverName} ${product.quantity}`;
    }

    // Priority 2: No quantity - extract type name from productType and use default "1"
    // If productType = "06 - Kiện" → extract "Kiện", return "1 Kiện"
    // If productType = "Kiện" → return "1 Kiện"
    const match = productType.match(/^(\d+)\s*-\s*(.+)$/);

    if (match) {
        const type = match[2].trim(); // Extract type name only (e.g., "Kiện")
        return `giao ${receiverName} 1 ${type}`;
    }

    // If productType doesn't have number format, use as-is with "1"
    if (productType.trim()) {
        return `giao ${receiverName} 1 ${productType.trim()}`;
    }

    // Final fallback
    return `giao ${receiverName} 1`;
}

/**
 * Transform Product to Booking
 *
 * Maps NhapHang product fields to TongHop booking fields
 *
 * @param {Object} product - Product from NhapHang
 * @param {Object} timeslot - Matched timeslot from TongHop
 * @param {number} seatNumber - Assigned seat number (1-28)
 * @returns {Object} - Booking data ready for TongHop API
 */
function transformProductToBooking(product, timeslot, seatNumber = 28) {
    return {
        // From product - direct mapping
        phone: product.receiverPhone || '',
        name: product.receiverName || '',
        amount: parseFloat(product.totalAmount) || 0,
        paid: parseFloat(product.totalAmount) || 0, // Already paid in freight

        // Hardcoded values for "Dọc đường" freight
        pickupMethod: 'Tại bến',
        pickupAddress: 'tại bến',
        dropoffMethod: 'Dọc đường',
        dropoffAddress: product.station || 'Dọc đường',

        // From timeslot - denormalized
        timeSlotId: timeslot.id,
        timeSlot: timeslot.time,
        date: timeslot.date,
        route: timeslot.route || '',

        // Computed
        note: formatBookingNote(product),

        // Auto-assigned seat number (first available from 1-28)
        seatNumber: seatNumber,
        gender: '',
        nationality: ''
    };
}

/**
 * Validate booking data before sending to API
 *
 * @param {Object} bookingData - Booking data to validate
 * @returns {Array<string>} - Array of error messages (empty if valid)
 */
function validateBookingData(bookingData) {
    const errors = [];

    if (!bookingData.phone) {
        errors.push('Thiếu số điện thoại người nhận');
    }

    if (!bookingData.name) {
        errors.push('Thiếu tên người nhận');
    }

    if (!bookingData.timeSlotId) {
        errors.push('Không tìm thấy khung giờ xe');
    }

    if (typeof bookingData.amount !== 'number' || bookingData.amount <= 0) {
        errors.push('Số tiền không hợp lệ');
    }

    if (!bookingData.timeSlot || !bookingData.date) {
        errors.push('Thiếu thông tin thời gian');
    }

    return errors;
}

module.exports = {
    transformProductToBooking,
    formatBookingNote,
    validateBookingData
};
