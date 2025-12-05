/**
 * TongHop Integration Service
 *
 * Main service for integrating with TongHop (Bus Booking) system
 * Orchestrates timeslot matching and booking creation
 */

const httpClient = require('../utils/http-client');
const tonghopConfig = require('../config/tonghop');
const { findNearestTimeslot } = require('./timeslot-matcher');
const { transformProductToBooking, validateBookingData } = require('./booking-transformer');

/**
 * Fetch all timeslots from TongHop API
 *
 * @returns {Promise<Array>} - Array of timeslot objects
 * @throws {Error} - If API call fails
 */
async function fetchTimeslots() {
    const url = `${tonghopConfig.apiUrl}${tonghopConfig.endpoints.timeslots}`;

    try {
        const response = await httpClient.get(url, {
            timeout: tonghopConfig.timeout
        });

        // TongHop can return either array directly or {success: true, timeslots: [...]}
        if (Array.isArray(response)) {
            return response;
        }
        return response.timeslots || [];
    } catch (error) {
        console.error('Failed to fetch timeslots from TongHop:', error.message);
        throw new Error(`Không thể lấy danh sách khung giờ xe: ${error.message}`);
    }
}

/**
 * Fetch bookings for a specific timeslot
 *
 * @param {number} timeslotId - Timeslot ID
 * @returns {Promise<Array>} - Array of booking objects
 * @throws {Error} - If API call fails
 */
async function fetchBookingsByTimeslot(timeslotId) {
    const url = `${tonghopConfig.apiUrl}${tonghopConfig.endpoints.bookings}?timeSlotId=${timeslotId}`;

    try {
        const response = await httpClient.get(url, {
            timeout: tonghopConfig.timeout
        });

        // Handle different response formats
        if (Array.isArray(response)) {
            return response;
        }
        return response.bookings || [];
    } catch (error) {
        console.error('Failed to fetch bookings from TongHop:', error.message);
        // Don't throw - return empty array to continue with seat assignment
        return [];
    }
}

/**
 * Find first available seat number (1-28)
 *
 * @param {Array} bookings - Array of existing bookings
 * @returns {number} - First available seat number (1-28)
 */
function findAvailableSeat(bookings) {
    const occupiedSeats = new Set(
        bookings
            .map(b => b.seatNumber)
            .filter(num => num >= 1 && num <= 28)
    );

    for (let seat = 1; seat <= 28; seat++) {
        if (!occupiedSeats.has(seat)) {
            return seat;
        }
    }

    // All seats occupied - default to seat 28 (will overwrite)
    return 28;
}

/**
 * Create booking in TongHop system
 *
 * @param {Object} bookingData - Booking data
 * @returns {Promise<Object>} - Created booking object
 * @throws {Error} - If API call fails or validation fails
 */
async function createBooking(bookingData) {
    // Validate data first
    const errors = validateBookingData(bookingData);
    if (errors.length > 0) {
        throw new Error(`Dữ liệu booking không hợp lệ: ${errors.join(', ')}`);
    }

    const url = `${tonghopConfig.apiUrl}${tonghopConfig.endpoints.bookings}`;

    try {
        const response = await httpClient.post(url, bookingData, {
            timeout: tonghopConfig.timeout
        });

        // TongHop returns { success: true, booking: {...} }
        return response.booking || response;
    } catch (error) {
        console.error('Failed to create booking in TongHop:', error.message);
        throw new Error(`Không thể tạo booking: ${error.message}`);
    }
}

/**
 * Create booking for product (Main orchestration function)
 *
 * Steps:
 * 1. Fetch available timeslots from TongHop
 * 2. Find nearest upcoming timeslot
 * 3. Transform product data to booking format
 * 4. Create booking via TongHop API
 *
 * @param {Object} product - Product object from NhapHang
 * @returns {Promise<Object>} - Created booking object
 * @throws {Error} - If any step fails
 */
async function createBookingForProduct(product) {
    const startTime = Date.now();

    try {
        // Step 1: Fetch timeslots
        console.log(`[TongHop] Fetching timeslots for product ${product.id}...`);
        const timeslots = await fetchTimeslots();

        if (!timeslots || timeslots.length === 0) {
            throw new Error('Không có khung giờ xe nào. Vui lòng kiểm tra lại TongHop system.');
        }

        console.log(`[TongHop] Found ${timeslots.length} timeslots`);

        // Step 2: Find nearest timeslot
        const timeslot = findNearestTimeslot(timeslots, new Date());

        if (!timeslot) {
            throw new Error('Không tìm thấy khung giờ xe phù hợp. Vui lòng tạo booking thủ công.');
        }

        console.log(`[TongHop] Matched timeslot: ${timeslot.time} on ${timeslot.date} (ID: ${timeslot.id})`);

        // Step 3: Find available seat
        const existingBookings = await fetchBookingsByTimeslot(timeslot.id);
        const availableSeat = findAvailableSeat(existingBookings);
        console.log(`[TongHop] Found ${existingBookings.length} existing bookings, assigned seat ${availableSeat}`);

        // Step 4: Transform data
        const bookingData = transformProductToBooking(product, timeslot, availableSeat);

        // Step 5: Create booking
        console.log(`[TongHop] Creating booking for product ${product.id}...`);
        const booking = await createBooking(bookingData);

        const duration = Date.now() - startTime;
        console.log(`[TongHop] ✅ Booking created successfully (ID: ${booking.id}, Seat: ${availableSeat}) in ${duration}ms`);

        return booking;
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[TongHop] ❌ Failed to create booking for product ${product.id} after ${duration}ms:`, error.message);
        throw error;
    }
}

/**
 * Check if TongHop integration is enabled and configured
 *
 * @returns {boolean}
 */
function isEnabled() {
    return tonghopConfig.enabled;
}

/**
 * Check if a product should trigger auto-booking
 *
 * @param {Object} product - Product object
 * @returns {boolean}
 */
function shouldCreateBooking(product) {
    if (!product || !product.station) {
        return false;
    }

    return tonghopConfig.shouldTriggerBooking(product.station);
}

/**
 * Health check - test connection to TongHop API
 *
 * @returns {Promise<Object>} - Health status
 */
async function healthCheck() {
    try {
        const timeslots = await fetchTimeslots();
        return {
            status: 'healthy',
            api_url: tonghopConfig.apiUrl,
            timeslots_count: timeslots.length,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            api_url: tonghopConfig.apiUrl,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = {
    createBookingForProduct,
    fetchTimeslots,
    createBooking,
    isEnabled,
    shouldCreateBooking,
    healthCheck
};
