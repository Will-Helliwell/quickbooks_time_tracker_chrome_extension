let countdownInterval = null;
const pollFrequencyMinutes = 0.15; // 0.25 = 15 seconds
const inTestMode = true; // TODO - get rid of this when finished testing

if (inTestMode) {
  console.log("Running in test mode");
  chrome.runtime.onInstalled.addListener(() => {
    // wait for 2 seconds before polling
    setTimeout(() => {
      pollForActivity(); // only do this once for testing purposes
    }, 2000);
  });
} else {
  console.log("Running in production mode");
  chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("pollForActivity", {
      periodInMinutes: pollFrequencyMinutes,
    });
  });
  // Listen for the alarm to trigger the polling function
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "pollForActivity") {
      pollForActivity();
    }
  });
}

async function pollForActivity() {
  console.log("Polling for activity...");

  const currentUserId = await getCurrentUserId();
  const currentTotalsResponse = await fetchCurrentTotals(currentUserId);
  currentTotalsResponse.api_call_timestamp = new Date().toISOString();

  if (!currentTotalsResponse) {
    return;
  }

  // extract variables from API response
  const onTheClock = currentTotalsResponse.on_the_clock;
  const APITimesheetId = currentTotalsResponse.timesheet_id;

  // get the active recording from local storage
  const storedActiveRecording = await getActiveRecordingFromLocalStorage();
  const storedActiveRecordingTimesheetId =
    storedActiveRecording.timesheet_id || null;

  // only update jobcodes if the active recording has changed
  if (storedActiveRecordingTimesheetId !== APITimesheetId) {
    chrome.runtime.sendMessage({ action: "updateJobcodesAndTimesheets" });
  }

  // Update local storage with the latest active timesheet
  overwriteActiveRecordingInStorage(currentTotalsResponse);

  // if currently on the clock, then update the badge with time remaining
  if (onTheClock) {
    const shiftSeconds = currentTotalsResponse.shift_seconds;
    const jobcodeId = currentTotalsResponse.jobcode_id;
    const jobcodeDetails = await getJobcodeFromStorage(
      currentUserId,
      jobcodeId
    );
    const secondsAssigned = jobcodeDetails.seconds_assigned ?? null;
    const secondsCompleted = jobcodeDetails.seconds_completed;
    const remainingSeconds =
      secondsAssigned == null
        ? null
        : secondsAssigned - secondsCompleted - shiftSeconds;

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
  if (seconds == null) {
    chrome.action.setBadgeText({ text: "∞" }); // display infinity
    chrome.action.setBadgeBackgroundColor({ color: "#FFA500" }); // orange
    return;
  }

  let displayText;
  const absSeconds = Math.abs(seconds);

  if (absSeconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    displayText = `${hours}h`;
  } else if (absSeconds >= 60) {
    const minutes = Math.round(seconds / 60);
    displayText = `${minutes}m`;
  } else {
    displayText = `${seconds}s`;
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

// Keep the countdown running every second and update the badge
function startLiveCountdown(remainingSeconds) {
  if (countdownInterval) {
    clearInterval(countdownInterval); // Avoid multiple intervals
  }

  if (remainingSeconds == null) {
    return; // Don't start countdown if user has not set a limit
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

/**
 * Retrieves the active recording data from Chrome's local storage.
 *
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to the active recording object
 *                            stored in local storage, or an empty object if none exists.
 */
async function getActiveRecordingFromLocalStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get("activeRecording", (data) => {
      resolve(data.activeRecording || {});
    });
  });
}
