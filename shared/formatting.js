/**
 * Shared formatting utility functions for Chrome extension
 * Can be used by both popup and background scripts
 */

/**
 * Formats seconds into human-readable time format (e.g., "2h 30m 15s")
 * @param {number} seconds - Number of seconds to format
 * @returns {string} Formatted time string
 */
export function formatSecondsToTime(seconds) {
  if (seconds === 0) return "0h 0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  let result = "";
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0) result += `${minutes}m`;
  if (remainingSeconds > 0 && hours === 0) result += ` ${remainingSeconds}s`;

  return result.trim();
}

/**
 * Formats a datetime string to readable start/end time format
 * Example: "2025-02-11T00:13:00-07:00" → "Tue 11th Feb, 07:15"
 * @param {string} datetimeString - ISO datetime string with timezone
 * @returns {string} Formatted datetime string
 */
export function formatStartEndTime(datetimeString) {
  const date = new Date(datetimeString);

  // Get day of week (short)
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });

  // Get day with ordinal suffix
  const day = date.getDate();
  const dayWithOrdinal = getDayWithOrdinal(day);

  // Get month (short)
  const month = date.toLocaleDateString("en-US", { month: "short" });

  // Get time in HH:MM format
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${weekday} ${dayWithOrdinal} ${month}, ${time}`;
}

/**
 * Gets day number with ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
 * @param {number} day - Day number (1-31)
 * @returns {string} Day with ordinal suffix
 */
function getDayWithOrdinal(day) {
  if (day >= 11 && day <= 13) {
    return `${day}th`;
  }

  const lastDigit = day % 10;
  switch (lastDigit) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/**
 * Formats a simple date string to readable format
 * Example: "2025-02-11" → "Mon, Feb 11"
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  const options = {
    month: "short",
    day: "numeric",
    weekday: "short",
  };
  return date.toLocaleDateString("en-US", options);
}
