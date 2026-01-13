/**
 * Updates jobcodes and timesheets in local storage by sending a message to the background script
 * to trigger the updateJobcodesAndTimesheetsFromAPI function.
 *
 * @async
 * @returns {Promise<boolean>} Returns true if the update was successful, false otherwise
 */
export async function updateJobcodesAndTimesheets() {
  try {
    const messageResponse = await chrome.runtime.sendMessage({
      action: "updateJobcodesAndTimesheets",
    });
    return messageResponse;
  } catch (error) {
    console.error("Error updating jobcodes and timesheets:", error);
    return false;
  }
}

/**
 * Updates the seconds assigned to a specific job code for the currently logged-in user in local storage.
 *
 * @async
 * @function
 * @param {string} jobcodeId - The ID of the job code to update.
 * @param {number|null} secondsAssigned - The number of seconds to assign to the job code.
 *                                         Use `null` to indicate no limit.
 * @returns {Promise<boolean>} A promise that resolves to the updated userProfile if the job code was updated successfully,
 *                             or `false` if the job code does not exist in storage.
 *
 * @throws {Error} If there is an issue retrieving the login details or accessing storage.
 */
export async function updateSecondsAssigned(jobcodeId, secondsAssigned) {
  // Get current login details
  const currentLoginDetails = await getLoginDetails();
  const currentUserId = currentLoginDetails.currentUserId;
  if (!currentUserId) {
    console.error("No logged in user found.");
    return false;
  }

  // Update the jobcode for that user if it exists
  return new Promise((resolve) => {
    chrome.storage.local.get("userProfiles", (data) => {
      const userProfiles = data.userProfiles || {};
      const userProfile = userProfiles[currentUserId];
      const jobcodes = userProfile?.jobcodes || {};

      if (jobcodes[jobcodeId]) {
        jobcodes[jobcodeId].seconds_assigned = secondsAssigned;
        userProfile.jobcodes = jobcodes;

        chrome.storage.local.set({
          userProfiles: {
            ...userProfiles,
            [currentUserId]: {
              ...userProfiles[currentUserId],
              jobcodes,
            },
          },
        });
        resolve(userProfile);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Retrieves the login details from Chrome's local storage.
 *
 * @returns {Promise<Object>} A promise that resolves to the login details object.
 */
async function getLoginDetails() {
  return new Promise((resolve) => {
    chrome.storage.local.get("loginDetails", (data) => {
      resolve(data.loginDetails);
    });
  });
}
