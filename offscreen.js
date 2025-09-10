chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle messages targeted to offscreen document
  if (message.target === "offscreen") {
    if (message.action === "playSound") {
      // Legacy pre-packaged sound playback
      const audioUrl = chrome.runtime.getURL(`sounds/${message.sound}.mp3`);
      playAudioFromUrl(
        audioUrl,
        message.soundName || message.sound,
        sendResponse
      );
      return true;
    }

    if (message.action === "playCustomSound") {
      // Custom sound with raw audio data
      try {
        // Convert array back to Uint8Array for Blob creation
        const audioBuffer = new Uint8Array(message.audioData);

        // Create blob URL from the audio data (this works in offscreen context)
        const blob = new Blob([audioBuffer], { type: message.mimeType });
        const blobUrl = URL.createObjectURL(blob);

        playAudioFromUrl(blobUrl, message.soundName, sendResponse, () => {
          // Clean up blob URL after playback
          setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
          }, 1000);
        });
      } catch (error) {
        console.error("Offscreen error creating custom sound:", error);
        sendResponse({ success: false, error: error.message });
      }

      return true;
    }

    if (message.action === "playCustomSoundById") {
      // Custom sound by ID - need to get audio data from IndexedDB
      handleCustomSoundById(message.soundId, sendResponse);
      return true;
    }
  }
});

// Helper function to play audio from a URL
function playAudioFromUrl(audioUrl, soundName, sendResponse, onSuccess = null) {
  const audio = new Audio(audioUrl);

  audio
    .play()
    .then(() => {
      sendResponse({ success: true });
      if (onSuccess) onSuccess();
    })
    .catch((error) => {
      console.error("Error playing sound:", error);
      sendResponse({ success: false, error: error.message });
    });
}

/**
 * Handle custom sound playback by ID - gets audio from IndexedDB
 * @param {string} soundId - The IndexedDB ID of the custom sound
 * @param {function} sendResponse - Response callback
 */
async function handleCustomSoundById(soundId, sendResponse) {
  try {
    // Import the audioStorage module
    const { getAudioFile } = await import("./shared/audioStorage.js");

    // Get the audio file from IndexedDB
    const audioRecord = await getAudioFile(soundId);

    if (!audioRecord) {
      throw new Error(`Custom sound with ID '${soundId}' not found`);
    }

    // Convert array back to Uint8Array for Blob creation
    const audioBuffer = new Uint8Array(audioRecord.data);

    // Create blob URL from the audio data
    const blob = new Blob([audioBuffer], { type: audioRecord.mimeType });
    const blobUrl = URL.createObjectURL(blob);

    playAudioFromUrl(blobUrl, audioRecord.name, sendResponse, () => {
      // Clean up blob URL after playback
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    });
  } catch (error) {
    console.error("Offscreen error playing custom sound by ID:", error);
    sendResponse({ success: false, error: error.message });
  }
}
