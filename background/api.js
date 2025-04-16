/**
 * Listens for messages from other parts of the extension and processes requests.
 * Handles requests to the TSheets API (excluding authentication).
 *
 * @param {Object} request - The message request object.
 * @param {chrome.runtime.MessageSender} sender - The sender of the message.
 * @param {function} sendResponse - The callback function to send a response.
 * @returns {boolean} Returns true to indicate the response will be sent asynchronously.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchCurrentUser") {
    getAuthToken()
      .then((ACCESS_TOKEN) => {
        if (!ACCESS_TOKEN) {
          sendResponse({
            success: false,
            error: "No access token found in fetchCurrentUser",
          });
          return;
        }

        fetch("https://rest.tsheets.com/api/v1/current_user", {
          method: "GET",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${ACCESS_TOKEN}`,
          },
        })
          .then((response) => response.json())
          .then((data) => {
            const user = Object.values(data.results.users)[0];
            if (user) {
              sendResponse({ success: true, user: user });
            } else {
              console.error("Get user failed:", data);
              sendResponse({ success: false, error: data });
            }
          })
          .catch((error) => {
            console.error("Fetch error:", error);
            sendResponse({ success: false, error: error.message });
          });
      })
      .catch((error) => {
        console.error("Error getting auth token:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keeps the message channel open for async response
  }
});

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
 * Retrieves the user profile for the given user ID from local storage.
 *
 * @param {string} userProfileId - The ID of the user profile to retrieve.
 * @returns {Promise<Object|null>} A promise resolving to the user profile object if found, otherwise null.
 */
async function getUserProfileFromStorage() {
  const loginDetails = await new Promise((resolve) => {
    chrome.storage.local.get("loginDetails", (data) => {
      resolve(data.loginDetails || {}); // Ensure we always return an object
    });
  });
  const userProfileId = loginDetails.currentUserId;
  const userProfiles = await new Promise((resolve) => {
    chrome.storage.local.get("userProfiles", (data) => {
      resolve(data.userProfiles || {}); // Ensure we always return an object
    });
  });

  // Return the profile if it exists, otherwise null
  return userProfiles[userProfileId] || null;
}

/**
 * Fetches the current totals of logged time for a given user from the Tsheets API.
 *
 * This function sends a POST request to the Tsheets API to retrieve current time tracking data
 * for the specified user. The request includes an authorization token and the user ID. If the
 * request is successful, the function returns the current time totals for the given user.
 * In case of failure, it logs errors and returns `null`.
 *
 * @param {string|number} currentUserId - The ID of the current user for whom the time totals are being fetched.
 *                                      It should be a valid user ID from the Tsheets API.
 *
 * @returns {Object|null} The current time totals for the user if the request is successful,
 *                       or `null` if there is an error or if the user’s data is not found.
 *
 * @throws {Error} Will throw an error if the fetch request fails or if the response status is not OK.
 */
async function fetchCurrentTotals(currentUserId) {
  const ACCESS_TOKEN = await getAuthToken();

  if (!ACCESS_TOKEN) {
    console.error("No access token found in fetchCurrentTotals");
    return null;
  }

  const postData = {
    data: {
      on_the_clock: "both",
      user_ids: currentUserId,
    },
  };

  try {
    const response = await fetch(
      "https://rest.tsheets.com/api/v1/reports/current_totals",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify(postData),
      }
    );

    if (!response.ok) {
      // Check if the response status is OK
      console.error("Request failed with status:", response.status);
      return null;
    }

    const data = await response.json(); // Parse the JSON response

    if (data.results) {
      return data.results.current_totals[currentUserId];
    } else {
      console.error("No results found in response:", data);
      return null;
    }
  } catch (error) {
    console.error("Fetch error:", error);
    return null;
  }
}

/**
 * Fetches jobcodes from the TSheets API.
 *
 * This function makes an authenticated GET request to the TSheets API to retrieve
 * all jobcodes for the authenticated user. It handles authentication, error cases,
 * and response validation.
 *
 * @async
 * @function getJobcodesFromAPI
 * @returns {Promise<Object|boolean>} Returns an object with success status and jobcodes response if successful,
 *                                   or false if the request fails or encounters an error.
 * @throws {Error} Will throw an error if the fetch request fails or if the response status is not OK.
 */
async function getJobcodesFromAPI() {
  const ACCESS_TOKEN = await getAuthToken();
  if (!ACCESS_TOKEN) {
    console.error("No access token found in getJobcodesFromAPI");
    return false;
  }

  try {
    const response = await fetch("https://rest.tsheets.com/api/v1/jobcodes", {
      method: "GET",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error("Request failed with status:", response.status);
      return false;
    }

    const data = await response.json();
    if (data.results) {
      return { success: true, jobcodesResponse: data };
    } else {
      console.error("No results found in response:", data);
      return false;
    }
  } catch (error) {
    console.error("Fetch error:", error);
    return false;
  }
}
