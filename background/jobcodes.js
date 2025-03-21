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
