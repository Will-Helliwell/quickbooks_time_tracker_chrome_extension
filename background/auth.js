const CLIENT_ID = "c68135e240a7e3c9e314171a1acec86e";
const REDIRECT_URL = `https://pcdfconcmbacamhingpjnbhjjhapkjke.chromiumapp.org/`
const STATE = "123";
const CLIENT_SECRET = "my_secret";

/**
 * Listens for messages from other parts of the extension and exchanges an authorization code for an access token.
 *
 * @callback messageListener
 * @param {Object} request - The message sent from the sender.
 * @param {string} request.action - The action type, expected to be "exchangeToken".
 * @param {string} request.code - The authorization code received from QuickBooks Time.
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
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,  // Store securely!
                code: request.code,  // The auth code from QuickBooks Time
                redirect_uri: REDIRECT_URL
            })
        })
        .then(response => response.json())
        .then(data => {
            
            if (data.access_token) {                
                // Store token securely in Chrome storage
                chrome.storage.local.set({ authToken: data.access_token, refreshToken: data.refresh_token });

                sendResponse({ success: true, token: data.access_token });
            } else {
                console.error("Token exchange failed:", data);
                sendResponse({ success: false, error: data });
            }
        })
        .catch(error => {
            console.error("Fetch error:", error);
            sendResponse({ success: false, error: error.message });
        });

        return true; // Keeps the message channel open for async response
    }
});