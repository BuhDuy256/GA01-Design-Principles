// Centralized date formatting utilities to avoid duplication (DRY principle)

/**
 * Format date for display with time
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale code (default: 'en-GB')
 * @returns {string} Formatted date string
 */
export const formatDateTimeForDisplay = (date, locale = 'en-GB') => {
    return new Date(date).toLocaleString(locale, {
        hour: '2-digit',
        minute: '2-digit', 
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

/**
 * Format date only (no time)
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale code (default: 'en-GB')
 * @returns {string} Formatted date string
 */
export const formatDateOnly = (date, locale = 'en-GB') => {
    return new Date(date).toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

/**
 * Format time only (no date)
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale code (default: 'en-GB')
 * @returns {string} Formatted time string
 */
export const formatTimeOnly = (date, locale = 'en-GB') => {
    return new Date(date).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};
