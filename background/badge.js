/**
 * This script handles the badge countdown for the Chrome extension.
 */

let badgeCountdownInterval = null;
let currentRemainingSeconds = null;

/**
 * Starts a countdown timer from the given argument; updates the badge text; triggers alerts accordingly.
 * If in the seconds range, it will update the badge text every second.
 *
 * @param {number|null} initialSeconds - The initial number of seconds for the countdown.
 *                                      If null, displays infinity symbol.
 * @returns {void}
 */
async function startBadgeCountdownAndTriggerAlerts(
  initialSeconds,
  userProfile
) {
  // Clear any existing interval
  if (badgeCountdownInterval) {
    clearInterval(badgeCountdownInterval);
  }

  currentRemainingSeconds = initialSeconds;

  // Update badge immediately with initial value
  updateBadge(currentRemainingSeconds, userProfile);

  // start coundown
  badgeCountdownInterval = setInterval(() => {
    currentRemainingSeconds--;

    // Update the badge text and color every second
    updateBadge(currentRemainingSeconds, userProfile);

    // Stop the countdown if we've reached 0 or gone negative
    if (currentRemainingSeconds <= 0) {
      clearInterval(badgeCountdownInterval);
      badgeCountdownInterval = null;
    }
  }, 1000);
}

function clearBadge() {
  if (badgeCountdownInterval) {
    clearInterval(badgeCountdownInterval);
    badgeCountdownInterval = null;
  }
  currentRemainingSeconds = null;
  chrome.action.setBadgeText({ text: "" });
  chrome.action.setBadgeBackgroundColor({ color: "#FFFFFF" }); // white
}

function updateBadge(seconds_remaining, userProfile) {
  // if the jobcode has not been assigned a limit, then display infinity
  if (seconds_remaining == null) {
    chrome.action.setBadgeText({ text: "∞" }); // display infinity
    chrome.action.setBadgeBackgroundColor({ color: "#FFA500" }); // orange
    return;
  }

  // render badge according to user alert preferences
  const alerts = userProfile.preferences.alerts || [];
  const badgeAlerts = alerts.filter((alert) => alert.type === "badge");

  // find the lowest alert time in seconds_remaining that is greater than the current remaining seconds_remaining
  const nextAlert = badgeAlerts
    .filter((alert) => alert.time_in_seconds >= seconds_remaining)
    .sort((a, b) => a.time_in_seconds - b.time_in_seconds)[0];

  // if there are no alerts, then set the badge to the default colour
  if (!nextAlert) {
    const defaultBadgeColour = seconds_remaining > 0 ? "#00AA00" : "#FF0000"; // green if > 0, red if <= 0
    chrome.action.setBadgeBackgroundColor({ color: defaultBadgeColour });
  } else {
    // otherwise, set the badge to the alert colour
    const alertColour = nextAlert.alert_string;
    chrome.action.setBadgeBackgroundColor({ color: alertColour });
  }

  // render the badge text
  let displayText;
  if (seconds_remaining >= 3600) {
    const hours = Math.round(seconds_remaining / 3600);
    displayText = `${hours}h`;
  } else if (seconds_remaining >= 60) {
    const minutes = Math.ceil(seconds_remaining / 60);
    displayText = `${minutes}m`;
  } else if (seconds_remaining > 0) {
    displayText = `${seconds_remaining}s`;
  } else {
    displayText = "over";
  }

  chrome.action.setBadgeText({ text: displayText });
}
