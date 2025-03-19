chrome.runtime.onInstalled.addListener(() => {
  // Set up an alarm that fires every 15 seconds
  chrome.alarms.create("pollForActivity", { periodInMinutes: 0.25 }); // 0.25 min = 15 sec
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pollForActivity") {
    pollForActivity();
  }
});

async function pollForActivity() {
  console.log("in pollForActivity");
}
