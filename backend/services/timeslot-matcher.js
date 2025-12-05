/**
 * Timeslot Matcher Service
 *
 * Finds the nearest upcoming timeslot based on current time.
 * Example: If current time is 9:10 AM, finds 9:30 AM timeslot
 */

/**
 * Format Date to TongHop format (DD-MM-YYYY)
 * @param {Date} date - JavaScript Date object
 * @returns {string} - Formatted date string (e.g., "05-12-2025")
 */
function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

/**
 * Parse time string to total minutes
 * @param {string} timeStr - Time in "HH:mm" format (e.g., "09:30")
 * @returns {number} - Total minutes (e.g., 570)
 */
function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Find nearest upcoming timeslot
 *
 * Algorithm:
 * 1. Filter timeslots for today that are in the future
 * 2. Sort by time (earliest first)
 * 3. Return first match
 * 4. If none today, get first timeslot of tomorrow
 * 5. Return null if no timeslots available
 *
 * @param {Array<Object>} timeslots - Array of timeslot objects
 * @param {Date} [currentTime] - Current time (defaults to now)
 * @returns {Object|null} - Matched timeslot or null
 *
 * @example
 * const timeslots = [
 *   { id: 1, time: '09:30', date: '05-12-2025' },
 *   { id: 2, time: '14:00', date: '05-12-2025' }
 * ];
 * const result = findNearestTimeslot(timeslots, new Date('2025-12-05T09:10:00'));
 * // Returns: { id: 1, time: '09:30', date: '05-12-2025' }
 */
function findNearestTimeslot(timeslots, currentTime) {
    if (!timeslots || timeslots.length === 0) {
        return null;
    }

    const now = currentTime || new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    const currentDateStr = formatDate(now);

    // Step 1: Filter timeslots for today
    const todaySlots = timeslots.filter(slot => slot.date === currentDateStr);

    // Step 2: Find future timeslots today (slots after current time)
    const futureSlots = todaySlots.filter(slot => {
        const slotTotalMinutes = parseTimeToMinutes(slot.time);
        return slotTotalMinutes > currentTotalMinutes;
    });

    // Step 3: If found future slots today, sort and return earliest
    if (futureSlots.length > 0) {
        futureSlots.sort((a, b) => {
            return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
        });
        return futureSlots[0];
    }

    // Step 4: No more slots today, try tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = formatDate(tomorrow);

    const tomorrowSlots = timeslots.filter(slot => slot.date === tomorrowDateStr);

    if (tomorrowSlots.length > 0) {
        // Sort by time and return earliest
        tomorrowSlots.sort((a, b) => {
            return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
        });
        return tomorrowSlots[0];
    }

    // Step 5: No timeslots available at all
    return null;
}

/**
 * Validate timeslot object
 * @param {Object} timeslot - Timeslot to validate
 * @returns {boolean} - True if valid
 */
function isValidTimeslot(timeslot) {
    return !!(
        timeslot &&
        timeslot.id &&
        timeslot.time &&
        timeslot.date &&
        typeof timeslot.time === 'string' &&
        typeof timeslot.date === 'string'
    );
}

module.exports = {
    findNearestTimeslot,
    formatDate,
    parseTimeToMinutes,
    isValidTimeslot
};
