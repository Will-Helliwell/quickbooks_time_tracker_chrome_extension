/**
 * Shared Audio Playback Helper
 *
 * This module contains audio playback functions that can be used across
 * different contexts in the Chrome extension.
 */

/**
 * Handle custom sound playback by ID - gets audio data from IndexedDB first
 * @param {string} soundId - The IndexedDB ID of the custom sound
 */
async function handleCustomSoundPlaybackById(soundId) {
  console.log("in handleCustomSoundPlaybackById with soundId:", soundId);

  // Create the offscreen document if it doesn't exist
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

  console.log("Sending sound ID to offscreen document for IndexedDB lookup");

  // Send sound ID to offscreen document - let it handle IndexedDB access
  chrome.runtime.sendMessage({
    target: "offscreen",
    action: "playCustomSoundById",
    soundId: soundId,
  });
}
