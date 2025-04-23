/**
 * This script handles all local storage operations for the extension backend.
 */

// LOGIN DETAILS

async function getLoginDetails() {
  return new Promise((resolve) => {
    chrome.storage.local.get("loginDetails", (data) => {
      resolve(data.loginDetails);
    });
  });
}

/**
 * Retrieves the authentication token from Chrome's local storage.
 * @returns {Promise<string>} A promise that resolves to the access token.
 */
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("loginDetails", (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.loginDetails.authToken);
      }
    });
  });
}

/**
 * Overwrites the stored login details in Chrome's local storage.
 *
 * If `loginDetails` does not exist, it initializes it with default values.
 * Then, it updates the authentication token, refresh token, expiry date,
 * and current user ID based on the provided API response.
 *
 * @param {string} accessToken - The new authentication token.
 * @param {string} refreshToken - The new refresh token.
 * @param {number} expiresIn - The token expiry time in seconds.
 * @param {string} userId - The ID of the currently logged-in user.
 */ function updateLoginDetails(accessToken, refreshToken, expiresIn, userId) {
  chrome.storage.local.get("loginDetails", (data) => {
    let loginDetails = data.loginDetails || {
      authToken: "",
      refreshToken: "",
      authTokenExpiryTimestamp: "",
      currentUserId: "",
    };

    // convert expiresIn to milliseconds and add to current time
    const authTokenExpiryTimestamp = new Date(
      Date.now() + expiresIn * 1000
    ).toISOString();

    // Update with new values from API response
    loginDetails.authToken = accessToken;
    loginDetails.refreshToken = refreshToken;
    loginDetails.authTokenExpiryTimestamp = authTokenExpiryTimestamp;
    loginDetails.currentUserId = userId;

    chrome.storage.local.set({ loginDetails }, () => {
      // console.log("Updated loginDetails:", loginDetails);
    });
  });
}

/**
 * Retrieves the current user ID from the local storage by looking at loginDetails.
 *
 * @returns {Promise<string|null>} A promise that resolves to the `currentUserId` if it is found in local storage,
 *                                 or `null` if the `currentUserId` is not available.
 */ async function getCurrentUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get("loginDetails", (data) => {
      resolve(data.loginDetails?.currentUserId || null);
    });
  });
}

// ACTIVE RECORDING

async function overwriteActiveRecordingInStorage(currentTotalsResponse) {
  chrome.storage.local.set({ activeRecording: currentTotalsResponse }, () => {
    // console.log(
    //   "Active recording updated in local storage:",
    //   currentTotalsResponse
    // );
  });
}

async function getActiveRecordingFromLocalStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get("activeRecording", (data) => {
      resolve(data.activeRecording || {});
    });
  });
}

// USER PROFILES

async function getUserProfileFromStorage(userProfileId) {
  return new Promise((resolve) => {
    chrome.storage.local.get("userProfiles", (data) => {
      const userProfiles = data.userProfiles || {};
      resolve(userProfiles[userProfileId] || null);
    });
  });
}
/**
 * Retrieves the user profile for the currently logged-in user (from oginDetails in local storage).
 *
 * @param {string} userProfileId - The ID of the user profile to retrieve.
 * @returns {Promise<Object|null>} A promise resolving to the user profile object if found, otherwise null.
 */
async function getUserProfileForLoggedInUserFromStorage() {
  const loginDetails = await new Promise((resolve) => {
    chrome.storage.local.get("loginDetails", (data) => {
      resolve(data.loginDetails || {}); // Ensure we always return an object
    });
  });
  const userProfileId = loginDetails.currentUserId;
  return getUserProfileFromStorage(userProfileId);
}

// JOBCODES

/**
 * Retrieves the specified jobcode from Chrome storage.
 *
 * @param {string} currentUserId - the user we are searching for
 * @param {string} jobcodeId - the jobcode we are searching for
 * @returns {Promise<object|null>} A promise resolving to the jobcodes object or null if not found.
 */
function getJobcodeFromStorage(currentUserId, jobcodeId) {
  return new Promise((resolve) => {
    chrome.storage.local.get("userProfiles", (data) => {
      const userProfiles = data.userProfiles || {};
      const jobcode = userProfiles[currentUserId]?.jobcodes[jobcodeId] || null;
      resolve(jobcode);
    });
  });
}

/**
 * Retrieves all jobcodes for the current user from Chrome storage.
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
