const CLIENT_ID = "c68135e240a7e3c9e314171a1acec86e";
const REDIRECT_URL = "https://example.com/";
const STATE = "123";

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
            console.log("Auth successful:", redirectUrl);
            const params = new URLSearchParams(new URL(redirectUrl).search);
            const authCode = params.get("code");

            if (authCode) {
                console.log("Authorization Code:", authCode);
            }
        }
    );
}
