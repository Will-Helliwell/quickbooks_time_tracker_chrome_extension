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

async function pollForActivity() {
  console.log("Polling for activity...");

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
    startBadgeCountdownAndTriggerAlerts(remainingSeconds, currentUserProfile);

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
