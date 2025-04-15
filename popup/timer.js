/**
 * Global variable to store the interval ID for the countdown timer.
 * @type {number|null}
 */
let countdownInterval = null;

/**
 * Global variable to store the interval ID for the countup timer.
 * @type {number|null}
 */
let countupInterval = null;

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
 * Starts a live countup timer that updates every second.
 * If there's an existing timer running, it will be cleared before starting a new one.
 *
 * @param {number} initialSeconds - The initial number of seconds to start counting from.
 * @param {function(number): void} updateCallback - A callback function that will be called
 *                                                 every second with the updated total seconds.
 *                                                 The callback should handle updating the UI.
 * @returns {void}
 */
export function startLiveCountup(initialSeconds, updateCallback) {
  if (countupInterval) {
    clearInterval(countupInterval); // Clear any existing interval
  }

  // Update immediately with initial value
  updateCallback(initialSeconds);

  countupInterval = setInterval(() => {
    initialSeconds++;
    updateCallback(initialSeconds);
  }, 1000);
}

/**
 * Stops all running timers (both countdown and countup) and cleans up the intervals.
 * This function is safe to call even if no timers are currently running.
 *
 * @returns {void}
 */
export function stopAllTimers() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (countupInterval) {
    clearInterval(countupInterval);
    countupInterval = null;
  }
}
