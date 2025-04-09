/**
 * Retrieves login details from Chrome's local storage.
 *
 * @async
 * @function
 * @returns {Promise<Object>} A promise that resolves to an object containing the login details.
 * If no login details are found, it resolves to an empty object.
 */
export async function getLoginDetailsFromLocalStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get("loginDetails", (result) => {
      resolve(result.loginDetails || {});
    });
  });
}
