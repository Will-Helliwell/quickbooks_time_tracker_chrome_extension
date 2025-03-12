/**
 * Fetches the user profile by first checking local storage.
 * If no stored profile is available, it fetches the latest user data from QuickBooks Time and stores the data for future use.
 *
 * @async
 * @returns {Promise<object>} The user profile object.
 */
export async function getUserProfile() {
  // Try to get user data from local storage first and UI immediately if so
  const storedUserProfile = await getUserProfileFromStorage();

  if (storedUserProfile) {
    // updateUserUI(storedUserProfile);
    return storedUserProfile;
  } else {
    // If no stored data, fetch from QuickBooks Time, save in storage and update UI
    const updatedUserProfile = await fetchCurrentUserFromQuickBooks();
    // updateUserUI(updatedUserProfile);
    saveUserProfileToStorage(updatedUserProfile);
    return updatedUserProfile;
  }
}

/**
 * Retrieves the user profile from Chrome storage.
 * @returns {Promise<object|null>} The user profile object or null if not found.
 */
function getUserProfileFromStorage() {
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
