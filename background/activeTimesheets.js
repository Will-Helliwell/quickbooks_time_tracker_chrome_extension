const pollFrequencyMinutes = 0.15; // 0.25 = 15 seconds
const inTestMode = false; // TODO - get rid of this when finished testing

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
  console.log(
    "storedActiveRecordingTimesheetId",
    storedActiveRecordingTimesheetId
  );
  console.log("APITimesheetId", APITimesheetId);

  if (storedActiveRecordingTimesheetId !== APITimesheetId) {
    console.log("active recording has changed, updating jobcodes");
    // update jobcodes and timesheets from API
    await updateJobcodesAndTimesheetsFromAPI();
  }

  // Update local storage with the latest active timesheet
  overwriteActiveRecordingInStorage(currentTotalsResponse);

  // if currently on the clock, then update the badge and notify the popup
  if (onTheClock) {
    // calculate the remaining seconds
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

    // Start or update the badge countdown
    startBadgeCountdown(remainingSeconds);

    // Notify the popup about the timer state
    try {
      await chrome.runtime.sendMessage({
        action: "onTheClock",
        remainingSeconds,
      });
    } catch (error) {
      // Ignore errors when popup is not open
      console.log("Popup not open, skipping timer update");
    }
  } else {
    clearBadge();
    // Notify the popup to stop the timer
    try {
      await chrome.runtime.sendMessage({ action: "offTheClock" });
    } catch (error) {
      // Ignore errors when popup is not open
      console.log("Popup not open, skipping timer stop");
    }
  }
}
