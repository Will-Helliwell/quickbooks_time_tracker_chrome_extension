export async function updateJobcodesFromAPI() {
  // update jobcodes from API
  let jobcodesAPIResponse = await getJobcodesFromAPI();
  jobcodesAPIResponse = processJobcodesAPIResponse(jobcodesAPIResponse);
  let jobcodesFromStorage = await getJobcodesFromStorage();
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

  chrome.storage.local.set({ jobcodes: updatedJobcodes });

  return true;
}

// JOBCODES

async function getJobcodesFromAPI() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "fetchJobcodes" }, (response) => {
      if (response && response.success) {
        resolve(response);
      } else {
        resolve(false);
      }
    });
  });
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
 * Retrieves the jobcodes from Chrome storage.
 * @returns {Promise<object|null>} The jobcodes object or null if not found.
 */
function getJobcodesFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (data) => {
      resolve(data["jobcodes"] || null);
    });
  });
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
      arrayToUpdate[APIJobcodeId] = jobcodesFromAPI[APIJobcodeId];

      arrayToUpdate[APIJobcodeId].timesheets = {};
    } else if (
      // if the jobcode already exists in the arrayToUpdate and the last_modified timestamp is different, then update it (preserving the timesheets object)
      arrayToUpdate[APIJobcodeId].last_modified !==
      jobcodesFromAPI[APIJobcodeId].last_modified
    ) {
      // arrayToUpdate[APIJobcodeId] = jobcodesFromAPI[APIJobcodeId];
      // update, preserving the timsheets object
      arrayToUpdate[APIJobcodeId] = {
        ...jobcodesFromAPI[APIJobcodeId],
        timesheets: arrayToUpdate[APIJobcodeId].timesheets,
      };
    }
  }

  return arrayToUpdate;
}

// TIMESHEETS

async function getTimesheetsFromAPI() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "fetchTimesheets" }, (response) => {
      if (response && response.success) {
        resolve(response);
      } else {
        resolve(false);
      }
    });
  });
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
    } else if (
      // if the timesheet already exists in memory and the last_modified timestamp is different, then update it
      memoryJobcodeTimesheets[APITimesheetId].last_modified !==
      timesheetsFromAPI[APITimesheetId].last_modified
    ) {
      memoryJobcodeTimesheets[APITimesheetId] =
        timesheetsFromAPI[APITimesheetId];
    }

    // update the jobcode in arrayToUpdate with the new timesheets
    arrayToUpdate[APITimesheetJobcodeId].timesheets = memoryJobcodeTimesheets;
  }

  return arrayToUpdate;
}
