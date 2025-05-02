/**
 * This script sllows client id to be defined once and stored locally, allowing access in both the front and backend.
 */

const CLIENT_ID = "c68135e240a7e3c9e314171a1acec86e";
chrome.storage.local.set({ client_id: CLIENT_ID });
