/**
 * This script handles all jobcodes and timesheets operations for the extension backend.
 */

// Add message listener for jobcodes and timesheets updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateJobcodesAndTimesheets") {
    updateJobcodesAndTimesheetsFromAPI()
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error("Error updating jobcodes and timesheets:", error);
        sendResponse({ success: false });
      });
    return true; // Keep the message channel open for async response
  }
});

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
      arrayToUpdate[APIJobcodeId].is_favourite = false;
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
        is_favourite: arrayToUpdate[APIJobcodeId].is_favourite,
      };
    } else {
      // if the jobcode already exists and is missing any of the keys that do not originate from the API, then add them
      arrayToUpdate[APIJobcodeId].timesheets =
        arrayToUpdate[APIJobcodeId].timesheets || {};
      arrayToUpdate[APIJobcodeId].seconds_completed =
        arrayToUpdate[APIJobcodeId].seconds_completed || 0;
      arrayToUpdate[APIJobcodeId].seconds_assigned =
        arrayToUpdate[APIJobcodeId].seconds_assigned || null;
      arrayToUpdate[APIJobcodeId].is_favourite =
        arrayToUpdate[APIJobcodeId].is_favourite || false;
    }
  }

  return arrayToUpdate;
}

// TIMESHEETS

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
