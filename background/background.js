/**
 * The scripts are loaded in the order listed below to ensure dependencies are met.
 * We structure it this way because Chrome extension service workers do not support ES modules and only allow a single background script.
 */
importScripts(
  // helper function files are below
  "/background/localStorage.js",
  "/background/audioPlaybackHelper.js",
  // main functional files are below
  "/background/api.js",
  "/background/auth.js",
  "/background/jobcodesAndTimesheets.js",
  "/background/countdownAndAlerts.js",
  "/background/audioPlayback.js",
  "/background/pollingScript.js"
);
