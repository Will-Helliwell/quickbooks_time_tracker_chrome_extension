export async function updateJobcodesFromAPI() {
  const jobcodesAPIResponse = await getJobcodesFromAPI();
  const jobcodes = processJobcodesAPIResponse(jobcodesAPIResponse);
  await updateJobcodesInStorage(jobcodes);

  const timesheetsAPIResponse = await getTimesheetsFromAPI();

  return jobcodes;
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
      console.log("Full storage contents:", data);
      resolve(data["jobcodes"] || null);
    });
  });
}

async function updateJobcodesInStorage(jobcodesFromAPI) {
  let jobcodesFromStorage = await getJobcodesFromStorage();

  // iterate over each jobcode received from the API
  for (const APIJobcodeId in jobcodesFromAPI) {
    // if there are no jobcodes in local storage, initialize it
    if (jobcodesFromStorage === null) {
      jobcodesFromStorage = {};
    }

    // if the jobcode does not exist in local storage, then add it
    if (!jobcodesFromStorage.hasOwnProperty(APIJobcodeId)) {
      jobcodesFromStorage[APIJobcodeId] = jobcodesFromAPI[APIJobcodeId];
    } else if (
      // if the jobcode already exists in local storage and the last_modified timestamp is different, then update it
      jobcodesFromStorage[APIJobcodeId].last_modified !==
      jobcodesFromAPI[APIJobcodeId].last_modified
    ) {
      jobcodesFromStorage[APIJobcodeId] = jobcodesFromAPI[APIJobcodeId];
    }
  }

  // overwrite the jobcodes local storage with the updated version
  chrome.storage.local.set({ jobcodes: jobcodesFromStorage });
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
