export async function getJobcodesFromAPI() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "fetchJobcodes" }, (response) => {
      if (response && response.success) {
        resolve(response);
      } else {
        resolve(false);
      }
    });
  });
}
