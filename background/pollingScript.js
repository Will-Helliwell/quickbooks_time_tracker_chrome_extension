const pollFrequencyMinutes = 0.25; // 15 seconds in minutes
const inTestMode = false; // Test mode only polls once, then stops

if (inTestMode) {
  chrome.runtime.onInstalled.addListener(() => {
    // wait for 2 seconds before polling
    setTimeout(() => {
      pollForActivity();
    }, 2000);
  });
} else {
  pollForActivity(); // Initial poll on startup
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

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "pollForActivity") {
    pollForActivity();
    sendResponse({ success: true });
  }
  return false; // Don't keep the message channel open
});

async function pollForActivity() {
  const currentUserId = await getCurrentUserIdFromLoginDetails();

  // exit early if no user is logged in
  if (!currentUserId) {
    return;
  }

  const currentUserProfile = await getUserProfileFromStorage(currentUserId);
  const currentTotalsResponse = await fetchCurrentTotals(currentUserId);
  currentTotalsResponse.api_call_timestamp = new Date().toISOString();

  if (!currentTotalsResponse) {
    return;
  }

  // extract variables from API response
  const onTheClock = currentTotalsResponse.on_the_clock;
  const APITimesheetId = currentTotalsResponse.timesheet_id;

  // get the stored active recording from local storage
  const storedActiveRecording = await getActiveRecordingFromLocalStorage();
  const storedActiveRecordingTimesheetId =
    storedActiveRecording.timesheet_id || null;

  // only update jobcodes if the active recording has changed
  if (storedActiveRecordingTimesheetId !== APITimesheetId) {
    await updateJobcodesAndTimesheetsFromAPI();
  }

  // Update local storage with the latest active timesheet
  overwriteActiveRecordingInStorage(currentTotalsResponse);

  // if currently on the clock, then update the badge and notify the popup
  if (onTheClock) {
    // calculate the remaining seconds
    const shiftSeconds = currentTotalsResponse.shift_seconds;
    const currentlyActiveJobcodeId = currentTotalsResponse.jobcode_id;
    const jobcodeDetails = await getJobcodeFromStorage(
      currentUserId,
      currentlyActiveJobcodeId
    );
    const secondsAssigned = jobcodeDetails.seconds_assigned ?? null;
    const secondsCompletedThisMonth =
      calculateSecondsCompletedThisMonth(jobcodeDetails);

    const remainingSeconds =
      secondsAssigned == null
        ? null
        : secondsAssigned - secondsCompletedThisMonth - shiftSeconds;

    // Start or update the badge countdown
    startBackgroundCountdown(
      currentlyActiveJobcodeId,
      remainingSeconds,
      currentUserProfile
    );

    // Notify the popup about the timer state
    try {
      await chrome.runtime.sendMessage({
        action: "onTheClock",
        remainingSeconds,
      });
    } catch (error) {
      // Ignore errors when popup is not open
    }
  } else {
    clearBadge();
    // Notify the popup to stop the timer
    try {
      await chrome.runtime.sendMessage({ action: "offTheClock" });
    } catch (error) {
      // Ignore errors when popup is not open
    }
  }
}

/**
 * Calculates the total duration of timesheets completed in the current month for a given jobcode
 *
 * @param {Object} jobcode - The jobcode object containing timesheet information
 * @param {Object} jobcode.timesheets - Object containing timesheet entries
 * @param {Object} jobcode.timesheets[].date - String date in format "YYYY-MM-DD"
 * @param {number} jobcode.timesheets[].duration - Duration in seconds
 * @returns {number} Total duration in seconds of timesheets from the current month
 */
function calculateSecondsCompletedThisMonth(jobcode) {
  const timesheets = jobcode.timesheets || {};
  return Object.values(timesheets).reduce((acc, timesheet) => {
    const timesheetDate = new Date(timesheet.date);
    const currentDate = new Date();
    const isCurrentMonth =
      timesheetDate.getMonth() === currentDate.getMonth() &&
      timesheetDate.getFullYear() === currentDate.getFullYear();
    if (isCurrentMonth) {
      return acc + timesheet.duration;
    }
    return acc;
  }, 0);
}
