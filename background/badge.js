/**
 * This script handles the badge countdown for the Chrome extension.
 */

let badgeCountdownInterval = null;
let currentRemainingSeconds = null;

function startBadgeCountdown(initialSeconds) {
  // Clear any existing interval
  if (badgeCountdownInterval) {
    clearInterval(badgeCountdownInterval);
  }

  currentRemainingSeconds = initialSeconds;
  // Update badge immediately with initial value
  updateBadge(currentRemainingSeconds);

  // Start countdown if we're in the seconds range
  if (Math.abs(initialSeconds) < 60) {
    badgeCountdownInterval = setInterval(() => {
      currentRemainingSeconds--;
      updateBadge(currentRemainingSeconds);

      // Stop the countdown if we've reached 0 or gone negative
      if (currentRemainingSeconds <= 0) {
        clearInterval(badgeCountdownInterval);
        badgeCountdownInterval = null;
      }
    }, 1000);
  }
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

function updateBadge(seconds) {
  if (seconds == null) {
    chrome.action.setBadgeText({ text: "∞" }); // display infinity
    chrome.action.setBadgeBackgroundColor({ color: "#FFA500" }); // orange
    return;
  }

  let displayText;

  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    displayText = `${hours}h`;
  } else if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    displayText = `${minutes}m`;
  } else if (seconds > 0) {
    displayText = `${seconds}s`;
  } else {
    displayText = "over";
  }

  chrome.action.setBadgeText({ text: displayText });

  let color;
  if (seconds <= 0) {
    color = "#FF0000"; // red
  } else if (seconds <= 3600) {
    color = "#FFA500"; // orange
  } else {
    color = "#00AA00"; // green
  }

  chrome.action.setBadgeBackgroundColor({ color });
}
