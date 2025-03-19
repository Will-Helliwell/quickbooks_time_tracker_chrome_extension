let countdownInterval = null;

chrome.runtime.onInstalled.addListener(() => {
  //   chrome.alarms.create("pollForActivity", { periodInMinutes: 0.02 }); // 0.25 = 15 seconds
  pollForActivity(); // only do this once for testing purposes
});
// Listen for the alarm to trigger the polling function
// chrome.alarms.onAlarm.addListener((alarm) => {
//   if (alarm.name === "pollForActivity") {
//     pollForActivity();
//   }
// });

async function pollForActivity() {
  console.log("Polling for activity...");

  const currentUserId = await getCurrentUserId();
  const currentTotalsResponse = await fetchCurrentTotals(currentUserId);
  console.log("currentTotalsResponse:", currentTotalsResponse);

  if (currentTotalsResponse) {
    const remainingSeconds = calculateRemainingTime(currentTotalsResponse);

    // TODO - store in local storage
    // chrome.storage.local.set({ remainingTime: remainingSeconds });

    updateBadge(remainingSeconds);

    startLiveCountdown(remainingSeconds);
  } else {
    // No active timesheet, clear badge
    chrome.action.setBadgeText({ text: "" });
  }
}

async function fetchActiveTimesheet() {
  // Mocking API response; replace with actual fetch call
  return {
    client: "Client A",
    seconds_active: 300, // 5 minutes left
  };
}

function calculateRemainingTime(currentTotalsResponse) {
  // Mocking a calculation; replace with real logic
  return currentTotalsResponse.seconds_active;
}

function updateBadge(seconds) {
  const minutes = Math.floor(seconds / 60);
  const displayText = `${seconds}s`;

  chrome.action.setBadgeText({ text: displayText });
  chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
}

// Keep the countdown running every second and update the badge
function startLiveCountdown(remainingSeconds) {
  if (countdownInterval) {
    clearInterval(countdownInterval); // Avoid multiple intervals
  }

  countdownInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      chrome.action.setBadgeText({ text: "" });
      clearInterval(countdownInterval);
      countdownInterval = null;
    } else {
      updateBadge(remainingSeconds);
    }
  }, 1000);
}
