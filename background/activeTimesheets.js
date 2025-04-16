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

// ALL JOBCODE LOGIC HERE

/**
 * Retrieves the jobcodes for the current user from Chrome storage.
 *
 * @param {string} currentUserId - The ID of the currently logged-in user.
 * @returns {Promise<object|null>} A promise resolving to the jobcodes object or null if not found.
 */
function getJobcodesFromStorage(currentUserId) {
  return new Promise((resolve) => {
    chrome.storage.local.get("userProfiles", (data) => {
      const userProfiles = data.userProfiles || {};
      const jobcodes = userProfiles[currentUserId]?.jobcodes || null;
      resolve(jobcodes);
    });
  });
}

async function updateJobcodesAndTimesheetsFromAPI() {
  // update jobcodes from API
  let jobcodesAPIResponse = await getJobcodesFromAPI();
  jobcodesAPIResponse = processJobcodesAPIResponse(jobcodesAPIResponse);
  const loginDetails = await getLoginDetails();
  const currentUserId = loginDetails.currentUserId;
  let jobcodesFromStorage = await getJobcodesFromStorage(currentUserId);
  let updatedJobcodes = updateMemoryWithJobcodesFromAPI(
    jobcodesAPIResponse,
    jobcodesFromStorage
  );

  // update timesheets from API
  const timesheetsAPIResponse = await getTimesheetsFromAPI();
  updatedJobcodes = updateMemoryWithTimesheetsFromAPI(
    timesheetsAPIResponse,
    updatedJobcodes
  );
  const lastFetchedTimesheets = new Date().toISOString();

  overwriteJobcodesInStorage(
    updatedJobcodes,
    currentUserId,
    lastFetchedTimesheets
  );

  return true;
}

function processJobcodesAPIResponse(response) {
  const jobcodes = response.jobcodesResponse.results.jobcodes;
  addParentPathName(jobcodes);
  return jobcodes;
}

/**
 * Iterates over the `jobcodes` object and adds a `parent_path_name` key to each entry.
 * Recursively constructs the parent path name until the root parent is reached.
 *
 * @param {Object} jobcodes - An object containing job codes where each key is a job code ID and its value is an object with job details.
 */
function addParentPathName(jobcodes) {
  for (const jobcode in jobcodes) {
    jobcodes[jobcode].parent_path_name = "";
    if (jobcodes[jobcode].parent_id !== 0) {
      jobcodes[jobcode].parent_path_name = getParentPathName(
        jobcodes,
        jobcodes[jobcode].parent_id
      );
    }
  }
}

/**
 * Recursively constructs the full parent path name for a given job code.
 *
 * @param {Object} jobcodes - An object containing job codes where each key is a job code ID and its value is an object with job details.
 * @param {number} parent_id - The ID of the parent job code.
 * @returns {string} - The full parent path name, constructed recursively.
 */
function getParentPathName(jobcodes, parent_id) {
  let parentPathName = "";
  if (jobcodes[parent_id].parent_id !== 0) {
    parentPathName =
      getParentPathName(jobcodes, jobcodes[parent_id].parent_id) +
      jobcodes[parent_id].name;
  } else {
    parentPathName = jobcodes[parent_id].name;
  }
  return parentPathName + "/";
}

/**
 * Updates the jobcodes in memory with the jobcodes received from the API.
 * @param {object} jobcodesFromAPI - The jobcodes object received from the API.
 * @param {object|null} arrayToUpdate - The jobcodes object in memory to update.
 * @returns {object} The updated jobcodes object.
 */
function updateMemoryWithJobcodesFromAPI(jobcodesFromAPI, arrayToUpdate) {
  // iterate over each jobcode received from the API
  for (const APIJobcodeId in jobcodesFromAPI) {
    // if there are no jobcodes in the arrayToUpdate, initialize it
    if (arrayToUpdate === null) {
      arrayToUpdate = {};
    }

    // if the jobcode does not exist in the arrayToUpdate, then add it
    if (!arrayToUpdate.hasOwnProperty(APIJobcodeId)) {
      // add the jobcode with the new data from the API
      arrayToUpdate[APIJobcodeId] = jobcodesFromAPI[APIJobcodeId];
      // add any keys that do not originate from the API
      arrayToUpdate[APIJobcodeId].timesheets = {};
      arrayToUpdate[APIJobcodeId].seconds_completed = 0;
      arrayToUpdate[APIJobcodeId].seconds_assigned = null;
    } else if (
      // if the jobcode already exists in the arrayToUpdate and the last_modified timestamp is different, then update it
      arrayToUpdate[APIJobcodeId].last_modified !==
      jobcodesFromAPI[APIJobcodeId].last_modified
    ) {
      arrayToUpdate[APIJobcodeId] = {
        // update the jobcode with the new data from the API
        ...jobcodesFromAPI[APIJobcodeId],
        // preserve any keys that do not originate from the API
        timesheets: arrayToUpdate[APIJobcodeId].timesheets,
        seconds_completed: arrayToUpdate[APIJobcodeId].seconds_completed,
        seconds_assigned: arrayToUpdate[APIJobcodeId].seconds_assigned,
      };
    } else {
      // if the jobcode already exists and is missing any of the keys that do not originate from the API, then add them
      arrayToUpdate[APIJobcodeId].timesheets =
        arrayToUpdate[APIJobcodeId].timesheets || {};
      arrayToUpdate[APIJobcodeId].seconds_completed =
        arrayToUpdate[APIJobcodeId].seconds_completed || 0;
      arrayToUpdate[APIJobcodeId].seconds_assigned =
        arrayToUpdate[APIJobcodeId].seconds_assigned || null;
    }
  }

  return arrayToUpdate;
}

/**
 * Updates the jobcodes and last_fetched_timestamps for the current user in Chrome storage by overwriting the existing jobcodes.
 *
 * @param {string} currentUserId - The ID of the currently logged-in user.
 * @param {object} updatedJobcodes - The updated jobcodes object to store.
 */
async function overwriteJobcodesInStorage(
  updatedJobcodes,
  currentUserId,
  lastFetchedTimesheets
) {
  chrome.storage.local.get("userProfiles", (data) => {
    chrome.storage.local.set({
      userProfiles: {
        ...data.userProfiles,
        [currentUserId]: {
          ...data.userProfiles?.[currentUserId],
          jobcodes: updatedJobcodes,
          last_fetched_timesheets: lastFetchedTimesheets,
        },
      },
    });
  });
}

// TIMESHEETS

async function getTimesheetsFromAPI() {
  const ACCESS_TOKEN = await getAuthToken();
  if (!ACCESS_TOKEN) {
    console.error("No access token found in getTimesheetsFromAPI");
    return false;
  }

  // Get the user profile to determine the fetch date range
  const userProfile = await getUserProfileFromStorage();
  if (!userProfile) {
    console.error("No user profile found");
    return false;
  }

  const userId = userProfile.id;

  // Calculate the fetch date range
  const userCreatedTimestamp = userProfile.created;
  const userCreatedDate = new Date(userCreatedTimestamp);
  const userCreatedDateString = `${userCreatedDate.getFullYear()}-${userCreatedDate.getMonth()}-${userCreatedDate.getDate()}`; // format YYYY-MM-DD

  const dayBeforeLastFetchedDate = new Date(
    new Date(userProfile.last_fetched_timesheets).getTime() - 86400000
  ); // 86400000 ms in a day

  const fetch_timesheets_from_date = userProfile.last_fetched_timesheets
    ? `${dayBeforeLastFetchedDate.getFullYear()}-${dayBeforeLastFetchedDate.getMonth()}-${dayBeforeLastFetchedDate.getDate()}`
    : userCreatedDateString;

  try {
    const response = await fetch(
      `https://rest.tsheets.com/api/v1/timesheets?start_date=${fetch_timesheets_from_date}&user_ids=${userId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Request failed with status:", response.status);
      return false;
    }

    const data = await response.json();
    if (data.results) {
      return { success: true, timesheetsResponse: data };
    } else {
      console.error("No results found in response:", data);
      return false;
    }
  } catch (error) {
    console.error("Fetch error:", error);
    return false;
  }
}

/**
 * Updates the jobcodes in memory with the timesheets received from the API.
 * @param {object} timesheetsAPIResponse - The timesheets object received from the API.
 * @param {object} arrayToUpdate - The jobcodes object in memory to update.
 * @returns {object} The updated jobcodes object.
 */
function updateMemoryWithTimesheetsFromAPI(
  timesheetsAPIResponse,
  arrayToUpdate
) {
  let jobcodesWithAddedUpdatedTimesheets = [];
  const timesheetsFromAPI =
    timesheetsAPIResponse.timesheetsResponse.results.timesheets;

  // iterate over each timesheet received from the API
  for (const APITimesheetId in timesheetsFromAPI) {
    const APITimesheetJobcodeId = timesheetsFromAPI[APITimesheetId].jobcode_id;

    // if the jobcode for the timesheet doesn't exist in memory yet, then skip it for now
    if (!arrayToUpdate.hasOwnProperty(APITimesheetJobcodeId)) {
      continue;
    }

    // find the jobcode associated with the timesheet
    const memoryJobcode = arrayToUpdate[APITimesheetJobcodeId];

    // if there are no timesheets for the jobcode in memory, initialize an empty object
    if (!memoryJobcode.hasOwnProperty("timesheets")) {
      memoryJobcode.timesheets = {};
    }
    // get the timesheets we already have for the jobcode in memory
    const memoryJobcodeTimesheets = memoryJobcode.timesheets;

    // if the timesheet does not exist in memory, then add it
    if (!memoryJobcodeTimesheets.hasOwnProperty(APITimesheetId)) {
      memoryJobcodeTimesheets[APITimesheetId] =
        timesheetsFromAPI[APITimesheetId];
      jobcodesWithAddedUpdatedTimesheets.push(APITimesheetJobcodeId);
    } else if (
      // if the timesheet already exists in memory and the last_modified timestamp is different, then update it
      memoryJobcodeTimesheets[APITimesheetId].last_modified !==
      timesheetsFromAPI[APITimesheetId].last_modified
    ) {
      memoryJobcodeTimesheets[APITimesheetId] =
        timesheetsFromAPI[APITimesheetId];
      jobcodesWithAddedUpdatedTimesheets.push(APITimesheetJobcodeId);
    }

    // update the jobcode in arrayToUpdate with the new timesheets
    arrayToUpdate[APITimesheetJobcodeId].timesheets = memoryJobcodeTimesheets;
  }

  // once all timesheets have been added or updated, update the seconds completed for each jobcode that was affected
  jobcodesWithAddedUpdatedTimesheets = [
    ...new Set(jobcodesWithAddedUpdatedTimesheets),
  ];
  for (const jobcodeId of jobcodesWithAddedUpdatedTimesheets) {
    arrayToUpdate[jobcodeId].seconds_completed = sumSecondsCompleted(
      arrayToUpdate[jobcodeId].timesheets
    );
  }

  return arrayToUpdate;
}

function sumSecondsCompleted(timesheets) {
  let secondsCompleted = 0;
  for (const timesheetId in timesheets) {
    secondsCompleted += timesheets[timesheetId].duration;
  }
  return secondsCompleted;
}

// LOGIN DETAILS

async function getLoginDetails() {
  return new Promise((resolve) => {
    chrome.storage.local.get("loginDetails", (data) => {
      resolve(data.loginDetails);
    });
  });
}

/**
 * Retrieves the user profile for the given user ID from local storage.
 *
 * @param {string} userProfileId - The ID of the user profile to retrieve.
 * @returns {Promise<Object|null>} A promise resolving to the user profile object if found, otherwise null.
 */
async function getUserProfileFromStorage() {
  const loginDetails = await new Promise((resolve) => {
    chrome.storage.local.get("loginDetails", (data) => {
      resolve(data.loginDetails || {}); // Ensure we always return an object
    });
  });
  const userProfileId = loginDetails.currentUserId;
  const userProfiles = await new Promise((resolve) => {
    chrome.storage.local.get("userProfiles", (data) => {
      resolve(data.userProfiles || {}); // Ensure we always return an object
    });
  });

  // Return the profile if it exists, otherwise null
  return userProfiles[userProfileId] || null;
}
