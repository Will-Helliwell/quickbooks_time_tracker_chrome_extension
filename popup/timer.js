/**
 * Global variable to store the interval ID for the countdown timer.
 * @type {number|null}
 */
let countdownInterval = null;

/**
 * Starts a live countdown timer that updates every second.
 * The timer will automatically stop when remaining seconds reaches 0.
 * If there's an existing timer running, it will be cleared before starting a new one.
 *
 * @param {number|null} remainingSeconds - The number of seconds to count down from.
 *                                        If null, no countdown will be started.
 * @param {function(number): void} updateCallback - A callback function that will be called
 *                                                 every second with the updated remaining seconds.
 *                                                 The callback should handle updating the UI.
 * @returns {void}
 */
export function startLiveCountdown(remainingSeconds, updateCallback) {
  if (countdownInterval) {
    clearInterval(countdownInterval); // Clear any existing interval
  }

  if (remainingSeconds == null) {
    return; // Don't start countdown if user has not set a limit
  }

  // Update immediately with initial value
  updateCallback(remainingSeconds);

  countdownInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds < 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      return;
    }
    updateCallback(remainingSeconds);
  }, 1000);
}

/**
 * Stops the currently running countdown timer and cleans up the interval.
 * This function is safe to call even if no timer is currently running.
 *
 * @returns {void}
 */
export function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}
