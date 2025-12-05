/**
 * TongHop Integration Configuration
 *
 * Configuration for integrating NhapHang system with TongHop (bus booking) system.
 * When a product is created with destination "Dọc đường", automatically creates
 * a booking in TongHop system.
 */

module.exports = {
    // Base URL of TongHop API
    apiUrl: process.env.TONGHOP_API_URL || 'http://localhost:5000',

    // Enable/disable integration
    enabled: process.env.TONGHOP_INTEGRATION_ENABLED === 'true',

    // Request timeout in milliseconds
    timeout: parseInt(process.env.TONGHOP_TIMEOUT) || 3000,

    // Retry configuration
    retryEnabled: process.env.TONGHOP_RETRY_ENABLED !== 'false',
    maxRetries: 1,
    retryDelay: 1000, // ms

    // API endpoints
    endpoints: {
        timeslots: '/api/timeslots',
        bookings: '/api/bookings'
    },

    // Trigger conditions - stations that trigger auto-booking
    triggerStations: [
        '00 - DỌC ĐƯỜNG',
        '00 - Dọc đường',
        'Dọc đường',
        'dọc đường'
    ],

    /**
     * Check if a station name should trigger auto-booking
     * @param {string} stationName - Station name from product
     * @returns {boolean}
     */
    shouldTriggerBooking(stationName) {
        if (!stationName) return false;

        const normalized = stationName.toLowerCase().trim();

        // Check exact matches
        if (this.triggerStations.some(s => s.toLowerCase() === normalized)) {
            return true;
        }

        // Check if contains "dọc đường"
        if (normalized.includes('dọc đường')) {
            return true;
        }

        // Check if starts with "00"
        if (normalized.startsWith('00')) {
            return true;
        }

        return false;
    }
};
