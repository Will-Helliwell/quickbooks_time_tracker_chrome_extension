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
            console.log("Offscreen cleaned up blob URL");
          }, 1000);
        });
      } catch (error) {
        console.error("Offscreen error creating custom sound:", error);
        sendResponse({ success: false, error: error.message });
      }

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
      console.log(`Successfully played sound: ${soundName}`);
      sendResponse({ success: true });
      if (onSuccess) onSuccess();
    })
    .catch((error) => {
      console.error("Error playing sound:", error);
      sendResponse({ success: false, error: error.message });
    });
}
