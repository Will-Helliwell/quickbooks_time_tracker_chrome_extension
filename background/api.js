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
  } else if (request.action === "fetchJobcodes") {
    getAuthToken()
      .then((ACCESS_TOKEN) => {
        if (!ACCESS_TOKEN) {
          sendResponse({
            success: false,
            error: "No access token found in fetchJobcodes",
          });
          return;
        }

        fetch("https://rest.tsheets.com/api/v1/jobcodes", {
          method: "GET",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Bearer ${ACCESS_TOKEN}`,
          },
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.results) {
              sendResponse({ success: true, jobcodesResponse: data });
            } else {
              console.error("Get jobcodes failed:", data);
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
  } else if (request.action === "fetchTimesheets") {
    getAuthToken()
      .then((ACCESS_TOKEN) => {
        if (!ACCESS_TOKEN) {
          sendResponse({
            success: false,
            error: "No access token found in fetchTimesheets",
          });
          return;
        }

        // get the user id and created from the userProfile object in chrome storage
        getUserProfile()
          .then((userProfile) => {
            if (!userProfile) {
              sendResponse({ success: false, error: "No user profile found" });
              return;
            }

            const userId = userProfile.id;
            const userCreatedTimestamp = userProfile.created;
            const userCreatedDate = new Date(userCreatedTimestamp);
            const userCreatedDateString = `${userCreatedDate.getFullYear()}-${userCreatedDate.getMonth()}-${userCreatedDate.getDate()}`; // format YYYY-MM-DD

            fetch(
              `https://rest.tsheets.com/api/v1/timesheets?start_date=${userCreatedDateString}&user_ids=${userId}`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Authorization: `Bearer ${ACCESS_TOKEN}`,
                },
              }
            )
              .then((response) => response.json())
              .then((data) => {
                if (data.results) {
                  sendResponse({ success: true, timesheetsResponse: data });
                } else {
                  console.error("Get timesheets failed:", data);
                  sendResponse({ success: false, error: data });
                }
              })
              .catch((error) => {
                console.error("Fetch error:", error);
                sendResponse({ success: false, error: error.message });
              });
          })
          .catch((error) => {
            console.error("Error getting user profile:", error);
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
    chrome.storage.local.get("authToken", (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.authToken);
      }
    });
  });
}

/**
 * Retrieves the User Profile from Chrome's local storage.
 * @returns {Promise<string>} A promise that resolves to the user profile.
 */
async function getUserProfile() {
  return new Promise((resolve) => {
    chrome.storage.local.get("userProfile", (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
      } else {
        resolve(result.userProfile);
      }
    });
  });
}
