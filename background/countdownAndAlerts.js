/**
 * This script handles the countdown timer and triggering of alerts for the extension.
 */

let backgroundCountdownReference = null;
let currentRemainingSeconds = null;
let hasNotificationPermission = false;

/**
 * Starts a countdown timer from the given argument; updates the badge text; triggers alerts accordingly.
 * If in the seconds range, it will update the badge text every second.
 *
 * @param {number|null} initialSeconds - The initial number of seconds for the countdown.
 *                                      If null, displays infinity symbol.
 * @returns {void}
 */
async function startBackgroundCountdown(
  currentlyActiveJobcodeId,
  initialSeconds,
  userProfile
) {
  // Clear any existing interval
  if (backgroundCountdownReference) {
    clearInterval(backgroundCountdownReference);
  }

  currentRemainingSeconds = initialSeconds;

  // immediately
  runAllAlertChecks(
    currentlyActiveJobcodeId,
    currentRemainingSeconds,
    userProfile
  );

  // exit early if no limit is assigned
  if (currentRemainingSeconds == null) {
    return;
  }

  // if the user has assigned a limit, start a countdown that runs the below code every second
  backgroundCountdownReference = setInterval(() => {
    currentRemainingSeconds--;

    // once every second
    runAllAlertChecks(
      currentlyActiveJobcodeId,
      currentRemainingSeconds,
      userProfile
    );

    // Stop the countdown if we've reached 0 or gone negative
    if (currentRemainingSeconds <= 0) {
      clearInterval(backgroundCountdownReference);
      backgroundCountdownReference = null;
    }
  }, 1000);
}

function runAllAlertChecks(
  currentlyActiveJobcodeId,
  currentRemainingSeconds,
  userProfile
) {
  updateBadge(currentlyActiveJobcodeId, currentRemainingSeconds, userProfile);
  checkForSoundAlerts(
    currentlyActiveJobcodeId,
    currentRemainingSeconds,
    userProfile
  );
  checkForChromeNotifcationAlerts(
    currentlyActiveJobcodeId,
    currentRemainingSeconds,
    userProfile
  );
}

/**
 * BADGE MANAGEMENT
 */
function clearBadge() {
  if (backgroundCountdownReference) {
    clearInterval(backgroundCountdownReference);
    backgroundCountdownReference = null;
  }
  currentRemainingSeconds = null;
  chrome.action.setBadgeText({ text: "" });
  chrome.action.setBadgeBackgroundColor({ color: "#FFFFFF" }); // white
}

/**
 * Updates the badge text and color based on the remaining seconds and user preferences
 */
function updateBadge(currentlyActiveJobcodeId, seconds_remaining, userProfile) {
  // if the jobcode has not been assigned a limit, then display infinity
  if (seconds_remaining == null) {
    chrome.action.setBadgeText({ text: "∞" }); // display infinity
    chrome.action.setBadgeBackgroundColor({ color: "#FFA500" }); // orange
    return;
  }

  // render badge according to user alert preferences
  const alerts = userProfile.preferences.alerts || [];

  const badgeAlerts = alerts.filter((alert) => {
    return (
      alert.type === "badge" &&
      (alert.jobcode_ids.length === 0 ||
        alert.jobcode_ids.includes(currentlyActiveJobcodeId))
    );
  });

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
    const alertColour = nextAlert.asset_reference;
    chrome.action.setBadgeBackgroundColor({ color: alertColour });
  }

  // render the badge text
  let displayText;
  if (seconds_remaining >= 3600) {
    const hours = (seconds_remaining / 3600).toFixed(1);
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

/**
 * SOUND MANAGEMENT
 */
function checkForSoundAlerts(
  currentlyActiveJobcodeId,
  seconds_remaining,
  userProfile
) {
  // Check if the user has any alerts set
  const alerts = userProfile.preferences.alerts || [];

  // Check for sound alerts
  const soundAlert = alerts.find((alert) => {
    const isSoundType =
      alert.type === "sound_default" || alert.type === "sound_custom";
    const isAtRightTime = alert.time_in_seconds === seconds_remaining;
    const appliesToActiveJobcode =
      alert.jobcode_ids.length === 0 ||
      alert.jobcode_ids.includes(currentlyActiveJobcodeId);
    return isSoundType && isAtRightTime && appliesToActiveJobcode;
  });

  // If a sound alert is found, play the appropriate sound
  if (soundAlert) {
    if (soundAlert.type === "sound_default") {
      // Play pre-packaged sound
      const soundName = soundAlert.asset_reference;
      playAudio(soundName);
    } else if (soundAlert.type === "sound_custom") {
      // Play custom sound using new playback system
      playCustomAudio(soundAlert.asset_reference);
    }
  }
}

async function playAudio(sound) {
  // Create the offscreen document if it doesn't exist
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Playing audio notifications",
    });
  }

  // Send message to the offscreen document to play the sound
  chrome.runtime.sendMessage({
    target: "offscreen",
    action: "playSound",
    sound: sound,
  });
}

/**
 * Play a custom audio file from IndexedDB using the new playback system
 * @param {string} audioId - The IndexedDB ID of the custom audio file
 */
async function playCustomAudio(audioId) {
  try {
    await handleCustomSoundPlaybackById(audioId);
  } catch (error) {
    console.error("Error playing custom audio:", error);
  }
}

/**
 * CHROME NOTIFICATION MANAGEMENT
 */
function checkForChromeNotifcationAlerts(
  currentlyActiveJobcodeId,
  seconds_remaining,
  userProfile
) {
  // Check if the user has any alerts set
  const alerts = userProfile.preferences.alerts || [];

  // Check for notification alerts
  const notificationAlert = alerts.find((alert) => {
    const isNotificationType = alert.type === "notification";
    const isAtRightTime = alert.time_in_seconds === seconds_remaining;
    const appliesToActiveJobcode =
      alert.jobcode_ids.length === 0 ||
      alert.jobcode_ids.includes(currentlyActiveJobcodeId);
    return isNotificationType && isAtRightTime && appliesToActiveJobcode;
  });

  // If a notification alert is found, create the notification
  if (notificationAlert) {
    createChromeAlert(seconds_remaining);
  }
}

async function createChromeAlert(seconds_remaining) {
  let message;
  if (seconds_remaining === 0) {
    message = "You have reached overtime!";
  } else if (seconds_remaining >= 3600) {
    const hours = Math.round(seconds_remaining / 3600);
    message = `${hours} hour${hours > 1 ? "s" : ""} remaining`;
  } else if (seconds_remaining >= 60) {
    const minutes = Math.ceil(seconds_remaining / 60);
    message = `${minutes} minute${minutes > 1 ? "s" : ""} remaining`;
  } else {
    message = `${seconds_remaining} second${
      seconds_remaining > 1 ? "s" : ""
    } remaining`;
  }

  chrome.notifications.create(
    {
      type: "basic",
      iconUrl: chrome.runtime.getURL("images/hourglass_icon_48.png"),
      title: "QuickBooks Time Alert",
      message: message,
      priority: 2,
      requireInteraction: true, // This will make the notification stay until you click it
      silent: false, // This will ensure the notification makes a sound
    },
    (_notificationId) => {
      if (chrome.runtime.lastError) {
        console.error("Error creating notification:", chrome.runtime.lastError);
      }
    }
  );
}
