const CLIENT_ID = chrome.runtime.getManifest().env.CLIENT_ID;
const REDIRECT_URL = chrome.identity.getRedirectURL();
/**
 * Listens for messages from other parts of the extension and exchanges an authorization code for an access token.
 * Note - this is in a background script because QBT has a CORS policy that prevents the exchange from happening in a content script.
 *
 * @callback messageListener
 * @param {Object} request - The message sent from the sender.
 * @param {string} request.action - The action type, expected to be "exchangeToken".
 * @param {string} request.code - The authorization code received from QuickBooks Time.
 * @param {string} request.client_secret - The client secret entered by the user.
 * @param {chrome.runtime.MessageSender} sender - The sender of the message.
 * @param {function} sendResponse - A callback function to send a response back to the sender.
 * @returns {boolean} Returns true to indicate the response will be sent asynchronously.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // exchange the authorization code for an access token and refresh token, then store both locally
  if (request.action === "exchangeToken") {
    fetch("https://rest.tsheets.com/api/v1/grant", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: request.clientSecret,
        code: request.code,
        redirect_uri: REDIRECT_URL,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.access_token) {
          updateLoginDetails(
            data.access_token,
            data.refresh_token,
            data.expires_in,
            data.user_id
          );
          sendResponse({ success: true, token: data.access_token });
        } else {
          console.error("Token exchange failed:", data);
          sendResponse({ success: false, error: data });
        }
      })
      .catch((error) => {
        console.error("Fetch error:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keeps the message channel open for async response
  }
});

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
 * Retrieves the current user ID from the local storage.
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
