let countdownInterval = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("pollForActivity", { periodInMinutes: 0.1 }); // 0.25 = 15 seconds
  pollForActivity(); // only do this once for testing purposes
});
// Listen for the alarm to trigger the polling function
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pollForActivity") {
    pollForActivity();
  }
});

async function pollForActivity() {
  console.log("Polling for activity...");

  const currentUserId = await getCurrentUserId();
  const currentTotalsResponse = await fetchCurrentTotals(currentUserId);
  currentTotalsResponse.api_call_timestamp = new Date().toISOString();

  if (!currentTotalsResponse) {
    return;
  }

  // TODO - if the timesheet id has changed, then will need to update jobcodes again so that seconds_completed has updated.

  // Update local storage with the latest active timesheet
  overwriteActiveRecordingInStorage(currentTotalsResponse);

  // if currently on the clock, then update the badge with time remaining
  const onTheClock = currentTotalsResponse.on_the_clock;
  if (onTheClock) {
    const shiftSeconds = currentTotalsResponse.shift_seconds;
    const jobcodeId = currentTotalsResponse.jobcode_id;
    const jobcodeDetails = await getJobcodeFromStorage(
      currentUserId,
      jobcodeId
    );
    const secondsAssigned = jobcodeDetails.seconds_assigned;
    const secondsCompleted = jobcodeDetails.seconds_completed;
    const remainingSeconds = secondsAssigned - secondsCompleted - shiftSeconds;

    updateBadge(remainingSeconds);

    startLiveCountdown(remainingSeconds);
  } else {
    // clear badge entirely (text and colour)
    chrome.action.setBadgeText({ text: "" });
    chrome.action.setBadgeBackgroundColor({ color: "#FFFFFF" }); // white
    // clear countdown in memory
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }
}

function updateBadge(seconds) {
  const minutes = Math.floor(seconds / 60);
  const displayText = `${seconds}s`;

  if (seconds > 0) {
    chrome.action.setBadgeText({ text: displayText });
    chrome.action.setBadgeBackgroundColor({ color: "#FFA500" }); // orange
  } else {
    chrome.action.setBadgeText({ text: displayText });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" }); // red
  }
}

// Keep the countdown running every second and update the badge
function startLiveCountdown(remainingSeconds) {
  if (countdownInterval) {
    clearInterval(countdownInterval); // Avoid multiple intervals
  }

  countdownInterval = setInterval(() => {
    remainingSeconds--;

    updateBadge(remainingSeconds);
  }, 1000);
}

// gets the currentRecording from local storage
async function getCurrentRecording() {
  return new Promise((resolve) => {
    chrome.storage.local.get("currentRecording", (data) => {
      resolve(data.currentRecording || {});
    });
  });
}

/**
 * Updates the active recording data in Chrome's local storage.
 *
 * @async
 * @function overwriteActiveRecordingInStorage
 * @param {Object} currentTotalsResponse - The data to be stored as the active recording.
 * @returns {Promise<void>} Resolves when the data has been successfully stored.
 */
async function overwriteActiveRecordingInStorage(currentTotalsResponse) {
  chrome.storage.local.set({ activeRecording: currentTotalsResponse }, () => {
    // console.log(
    //   "Active recording updated in local storage:",
    //   currentTotalsResponse
    // );
  });
}
