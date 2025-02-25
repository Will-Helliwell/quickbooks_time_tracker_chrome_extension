const CLIENT_ID = "c68135e240a7e3c9e314171a1acec86e";
const REDIRECT_URL = `https://pcdfconcmbacamhingpjnbhjjhapkjke.chromiumapp.org/`
const STATE = "123";

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
    return new Promise((resolve) => {
        chrome.identity.launchWebAuthFlow(
            {
                url: `https://rest.tsheets.com/api/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URL}&state=${STATE}`,
                interactive: true
            },
            (redirectUrl) => {
                if (chrome.runtime.lastError) {
                    console.error("OAuth failed:", chrome.runtime.lastError);
                    resolve(false);
                    return;
                }
                const params = new URLSearchParams(new URL(redirectUrl).search);
                const authCode = params.get("code");

                if (authCode) {
                    const CLIENT_SECRET = document.getElementById("client-secret").value;
                    chrome.runtime.sendMessage(
                        { action: "exchangeToken", code: authCode, clientSecret: CLIENT_SECRET },
                        (response) => {
                            if (response && response.success) {
                                resolve(true);
                            } else {
                                alert("Did you enter the client secret correctly?");
                                resolve(false);
                            }
                        }
                    );
                } else {
                    resolve(false);
                }
            }
        );
    });
}





