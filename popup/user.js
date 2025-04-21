/**
 * Loads a user profile from local storage. If the user profile is not found,
 * it fetches the user profile from an API and updates the local storage.
 *
 * @param {string} userProfileId - The unique identifier of the user profile to load.
 * @returns {Promise<Object>} A promise that resolves to the user profile object.
 */
export async function loadOrFetchUserProfile(userProfileId) {
  let userProfile = await getUserProfileFromStorage(userProfileId);
  if (userProfile === null) {
    userProfile = await updateUserProfileFromAPI();
  }

  return userProfile;
}

/**
 * Retrieves the user profile for the given user ID from local storage.
 *
 * @param {string} userProfileId - The ID of the user profile to retrieve.
 * @returns {Promise<Object|null>} A promise resolving to the user profile object if found, otherwise null.
 */
export async function getUserProfileFromStorage(userProfileId) {
  const userProfiles = await new Promise((resolve) => {
    chrome.storage.local.get("userProfiles", (data) => {
      resolve(data.userProfiles || {}); // Ensure we always return an object
    });
  });

  return userProfiles[userProfileId] || null;
}

/**
 * Fetches the user profile by first checking local storage.
 * If no stored profile is available, it fetches the latest user data from QuickBooks Time and stores the data for future use.
 *
 * @async
 * @returns {Promise<object>} The user profile object.
 */
export async function updateUserProfileFromAPI() {
  const userProfileAPI = await fetchCurrentUserFromQuickBooks();
  const userProfileId = userProfileAPI.id;
  const userProfileAPILastModifiedTimestamp = userProfileAPI.last_modified;
  await initialiseUserProfiles();
  const userProfileStored = await getUserProfileFromStorage(userProfileId);

  // If the current user has never logged in on this machine, save the fetched user profile and return it
  if (!userProfileStored) {
    userProfileAPI.last_fetched_timesheets = null; // add last_fetched_timesheets to the user profile
    userProfileAPI.jobcodes = {}; // add jobcodes to the user profile
    userProfileAPI.preferences = {}; // initialize preferences
    userProfileAPI.preferences.themeChoice = "light"; // add themeChoice to the user profile
    saveUserProfileToStorage(userProfileAPI);
    return userProfileAPI;
  }

  const userProfileStoredLastModifiedTimestamp =
    userProfileStored.last_modified;

  // If the stored user profile is up-to-date, return it
  if (
    userProfileStoredLastModifiedTimestamp ===
    userProfileAPILastModifiedTimestamp
  ) {
    return userProfileStored;
  } else {
    // If the stored user profile is outdated, then update the storage with the latest data and return it
    userProfileAPI.last_fetched_timesheets =
      userProfileStored.last_fetched_timesheets; // preserve last_fetched_timesheets
    userProfileAPI.jobcodes = userProfileStored.jobcodes; // preserve jobcodes
    userProfileAPI.preferences = userProfileStored.preferences; // preserve all preferences
    saveUserProfileToStorage(userProfileAPI);
    return userProfileAPI;
  }
}

/**
 * Saves the user profile to Chrome storage under its ID.
 * If the userProfiles object doesn't exist, it initializes it first.
 *
 * @param {object} user - The user profile object to save. Must contain an `id` property.
 */
function saveUserProfileToStorage(user) {
  if (!user || !user.id) {
    console.error("Invalid user object. Missing 'id' property.");
    return;
  }

  chrome.storage.local.get("userProfiles", (data) => {
    let userProfiles = data.userProfiles || {}; // Ensure it’s an object

    // Overwrite the user profile with the same ID
    userProfiles[user.id] = user;

    chrome.storage.local.set({ userProfiles }, () => {
      console.log(`User profile saved for ID: ${user.id}`);
    });
  });
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

/**
 * Initializes the userProfiles object in Chrome storage if it doesn't exist.
 * This function ensures that the `userProfiles` object is available in local storage,
 * defaulting to an empty object if it's not already set.
 *
 * @async
 * @function initialiseUserProfiles
 * @returns {Promise<void>} Resolves when the initialization is complete.
 */
async function initialiseUserProfiles() {
  chrome.storage.local.get("userProfiles", (data) => {
    if (!data.userProfiles) {
      chrome.storage.local.set({ userProfiles: {} });
    }
  });
}
