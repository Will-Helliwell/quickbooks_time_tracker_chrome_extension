/**
 * Fetches the user profile by first checking local storage.
 * If no stored profile is available, it fetches the latest user data from QuickBooks Time and stores the data for future use.
 *
 * @async
 * @returns {Promise<object>} The user profile object.
 */
export async function updateUserProfileFromAPI() {
  const userProfileAPI = await fetchCurrentUserFromQuickBooks();
  const userProfileAPILastModifiedTimestamp = userProfileAPI.last_modified;
  const userProfileStored = await getUserProfileFromStorage();

  // If no nobody has logged in before, save the fetched user profile and return it
  if (!userProfileStored) {
    userProfileAPI.last_fetched_timesheets = null; // add last_fetched_timesheets to the user profile
    saveUserProfileToStorage(userProfileAPI);
    return userProfileAPI;
  }

  const userProfileStoredLastModifiedTimestamp =
    userProfileStored.last_modified;
  const userProfileStoredUserId = userProfileStored.id;

  // If a different user has logged in on the same machine, log the old user out and save the fetched user profile
  if (userProfileStoredUserId !== userProfileAPI.id) {
    userProfileAPI.last_fetched_timesheets = null; // add last_fetched_timesheets to the user profile
    saveUserProfileToStorage(userProfileAPI);
    chrome.storage.local.remove("jobcodes"); // delete jobcodes from local storage to log the old user out
    return userProfileAPI;
  } else if (
    // If the same user has logged in and the stored user profile is up-to-date, return it
    userProfileStoredLastModifiedTimestamp ===
    userProfileAPILastModifiedTimestamp
  ) {
    return userProfileStored;
  } else {
    // If the same user has logged in and stored user profile is outdated, then update the storage with the latest data and return it
    userProfileAPI.last_fetched_timesheets = null; // add last_fetched_timesheets to the user profile
    saveUserProfileToStorage(userProfileAPI);
    return userProfileAPI;
  }
}

/**
 * Retrieves the user profile from Chrome storage.
 * @returns {Promise<object|null>} The user profile object or null if not found.
 */
export async function getUserProfileFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get("userProfile", (data) => {
      resolve(data.userProfile || null);
    });
  });
}

/**
 * Saves the user profile to Chrome storage.
 * @param {object} user The user profile object to save.
 */
function saveUserProfileToStorage(user) {
  chrome.storage.local.set({ userProfile: user });
}

/**
 * Fetches the current user data from QuickBooks Time by sending a message to the background script.
 *
 * @async
 * @returns {Promise<Object|false>} Resolves with the user object if successful, otherwise resolves to `false`.
 */
async function fetchCurrentUserFromQuickBooks() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "fetchCurrentUser" }, (response) => {
      if (response && response.success) {
        resolve(response.user);
      } else {
        resolve(false);
      }
    });
  });
}
