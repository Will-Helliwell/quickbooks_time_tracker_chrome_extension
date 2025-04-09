/**
 * Retrieves the active recording data from Chrome's local storage.
 *
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to the active recording object
 *                            stored in local storage, or an empty object if none exists.
 */
export async function getActiveRecordingFromLocalStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get("activeRecording", (data) => {
      resolve(data.activeRecording || {});
    });
  });
}
