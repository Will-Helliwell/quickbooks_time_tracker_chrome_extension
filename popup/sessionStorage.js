/**
 * Loads the last typed client ID from session storage and populates the input field
 * @param {HTMLInputElement} clientIdInput - The client ID input element
 */
export function loadLastTypedClientId(clientIdInput) {
  chrome.storage.session.get(["lastTypedClientId"], (result) => {
    if (result.lastTypedClientId) {
      clientIdInput.value = result.lastTypedClientId;
    }
  });
}

/**
 * Sets up an event listener to save the client ID to session storage on every keystroke
 * @param {HTMLInputElement} clientIdInput - The client ID input element
 */
export function setupClientIdSessionStorage(clientIdInput) {
  clientIdInput.addEventListener("input", () => {
    chrome.storage.session.set({ lastTypedClientId: clientIdInput.value });
  });
}

/**
 * Clears the saved client ID from session storage
 * Useful to call after successful login
 */
export function clearLastTypedClientId() {
  chrome.storage.session.remove(["lastTypedClientId"]);
}
