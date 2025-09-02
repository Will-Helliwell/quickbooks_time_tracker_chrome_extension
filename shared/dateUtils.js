/**
 * Shared date utility functions for Chrome extension
 * Can be used by both popup and background scripts
 */

/**
 * Gets the current date for consistent date calculations across the app
 * @returns {Date} Current date
 */
export function getCurrentDate() {
  return new Date();
}

/**
 * Checks if a date is in the current month
 * @param {Date|string} date - Date to check (Date object or date string)
 * @returns {boolean} True if date is in current month
 */
export function isDateInCurrentMonth(date) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const currentDate = getCurrentDate();

  return (
    dateObj.getMonth() === currentDate.getMonth() &&
    dateObj.getFullYear() === currentDate.getFullYear()
  );
}

/**
 * Gets the current month and year as an object
 * @returns {Object} Object with month and year properties
 */
export function getCurrentMonthYear() {
  const currentDate = getCurrentDate();
  return {
    month: currentDate.getMonth(),
    year: currentDate.getFullYear(),
  };
}
