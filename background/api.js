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
        getAuthToken().then((ACCESS_TOKEN) => {
            if (!ACCESS_TOKEN) {
                sendResponse({ success: false, error: "No access token found" });
                return;
            }

            fetch("https://rest.tsheets.com/api/v1/current_user", {
                method: "GET",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": `Bearer ${ACCESS_TOKEN}`
                }
            })
            .then(response => response.json())
            .then(data => {
                const user = Object.values(data.results.users)[0];
                if (user) {
                    sendResponse({ success: true, user: user });
                } else {
                    console.error("Get user failed:", data);
                    sendResponse({ success: false, error: data });
                }
            })
            .catch(error => {
                console.error("Fetch error:", error);
                sendResponse({ success: false, error: error.message });
            });
        }).catch(error => {
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
        chrome.storage.local.get('authToken', (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result.authToken);
            }
        });
    });
}
