const CLIENT_ID = chrome.runtime.getManifest().env.CLIENT_ID;
import { REDIRECT_URL } from "/src/config.js";
const STATE = "123";

/**
 * Initiates the OAuth authentication process using Chrome's identity API.
 *
 * This function launches a web authentication flow for the TSheets API, prompting
 * the user to authorize access. If successful, it retrieves the authorization code
 * from the redirect URL and exchanges it for an access token and refresh token by calling the background script.
 *
 * @returns {void}
 */
export function authenticateUser() {
  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: `https://rest.tsheets.com/api/v1/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URL}&state=${STATE}`,
        interactive: true,
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
            {
              action: "exchangeToken",
              code: authCode,
              clientSecret: CLIENT_SECRET,
            },
            (response) => {
              if (response && response.success) {
                resolve(true);
              } else {
                alert(
                  "Login failed. Did you enter the client secret correctly?"
                );
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

export function logout() {
  chrome.storage.local.remove("loginDetails");
  window.location.reload();
}
