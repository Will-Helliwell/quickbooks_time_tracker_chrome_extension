const CLIENT_ID = "c68135e240a7e3c9e314171a1acec86e";
const REDIRECT_URL = `https://pcdfconcmbacamhingpjnbhjjhapkjke.chromiumapp.org/`
const STATE = "123";
const CLIENT_SECRET = "my_secret";

/**
 * Initiates the OAuth authentication process using Chrome's identity API.
 * 
 * This function launches a web authentication flow for the TSheets API, prompting
 * the user to authorize access. If successful, it retrieves the authorization code
 * from the redirect URL.
 * 
 * @returns {void}
 */
function authenticateUser() {
    chrome.identity.launchWebAuthFlow(
        {
            url: `https://rest.tsheets.com/api/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URL}&state=${STATE}`,
            interactive: true
        },
        (redirectUrl) => {
            if (chrome.runtime.lastError) {
                console.error("OAuth failed:", chrome.runtime.lastError);
                return;
            }
            const params = new URLSearchParams(new URL(redirectUrl).search);
            const authCode = params.get("code");

            if (authCode) {
                // Send the auth code to the background script for token exchange
                chrome.runtime.sendMessage({ action: "exchangeToken", code: authCode });
            }
        }
    );
}




