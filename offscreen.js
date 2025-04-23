chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "playSound") {
    const audio = new Audio(
      chrome.runtime.getURL(`sounds/${message.sound}.mp3`)
    );
    audio.play().catch((error) => {
      console.error("Error playing sound:", error);
    });
  }
});
