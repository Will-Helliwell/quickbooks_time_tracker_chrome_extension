/**
 * Background Audio Playback Module
 *
 * This module handles audio playback requests from the popup and other extension contexts.
 * It manages the offscreen document creation and routes audio data appropriately.
 */

initializeAudioPlayback();

/**
 * Initialize audio playback message listeners
 * Called from background.js to set up message handling
 */
function initializeAudioPlayback() {
  // Message listener for audio playback requests
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "playPrePackagedSound") {
      handlePrePackagedSoundPlayback(message.soundName)
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Keep message channel open for async response
    }

    if (message.action === "playCustomSound") {
      handleCustomSoundPlayback(
        message.audioData,
        message.mimeType,
        message.soundName
      )
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Keep message channel open for async response
    }

    if (message.action === "playCustomSoundById") {
      handleCustomSoundPlaybackById(message.soundId)
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Keep message channel open for async response
    }
  });
}

/**
 * Handle pre-packaged sound playback
 * @param {string} soundName - Name of the pre-packaged sound file
 */
async function handlePrePackagedSoundPlayback(soundName) {
  // Create the offscreen document if it doesn't exist
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Playing audio notifications",
    });
  }

  // Send message to the offscreen document to play the sound (using existing format)
  chrome.runtime.sendMessage({
    target: "offscreen",
    action: "playSound",
    sound: soundName,
  });
}

/**
 * Handle custom sound playbook from IndexedDB
 * @param {Array} audioData - Audio data as array (from message serialization)
 * @param {string} mimeType - MIME type of the audio file
 * @param {string} soundName - Name of the custom sound
 */
async function handleCustomSoundPlayback(audioData, mimeType, soundName) {
  // Create the offscreen document if it doesn't exist
  console.log("in handleCustomSoundPlayback with soundName:", soundName);

  if (!(await chrome.offscreen.hasDocument())) {
    console.log("creating offscreen document...");

    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Playing audio notifications",
    });
  } else {
    console.log("offscreen document already exists");
  }

  console.log("Sending raw audio data to offscreen document");

  // Send raw audio data to offscreen document - let it create the blob URL
  chrome.runtime.sendMessage({
    target: "offscreen",
    action: "playCustomSound",
    audioData: audioData,
    mimeType: mimeType,
    soundName: soundName,
  });
}

// handleCustomSoundPlaybackById is now imported from shared helper
