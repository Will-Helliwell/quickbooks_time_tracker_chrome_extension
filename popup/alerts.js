import { overwriteUserProfileInStorage } from "/popup/user.js";

// Function to add a new alert
export async function addNewAlert(userProfile) {
  const hours = parseInt(document.getElementById("alert-hours").value) || 0;
  const minutes = parseInt(document.getElementById("alert-minutes").value) || 0;
  const seconds = parseInt(document.getElementById("alert-seconds").value) || 0;
  const color = document.getElementById("alert-color").value;

  const timeInSeconds = convertToSeconds(hours, minutes, seconds);

  if (timeInSeconds === 0) {
    alert("Please enter a valid time for your new alert.");
    return;
  }

  // Check for existing alert with same time
  if (userProfile.preferences.alerts) {
    const existingAlert = userProfile.preferences.alerts.find(
      (alert) =>
        alert.type === "badge_colour" && alert.time_in_seconds === timeInSeconds
    );

    if (existingAlert) {
      alert(
        `An alert already exists for ${formatTime(
          timeInSeconds
        )}. Please choose a different time.`
      );
      return;
    }
  }

  const newAlert = {
    type: "badge_colour",
    time_in_seconds: timeInSeconds,
    alert_string: color,
  };

  // Add to DOM
  const activeAlerts = document.getElementById("active-alerts");
  activeAlerts.appendChild(createAlertElement(newAlert, userProfile));

  // Save new alert to local storage
  if (
    !userProfile.preferences.alerts ||
    !Array.isArray(userProfile.preferences.alerts)
  ) {
    // Convert existing alerts object to array if it exists, or create new array
    userProfile.preferences.alerts = Object.values(
      userProfile.preferences.alerts || {}
    );
  }

  userProfile.preferences.alerts.push(newAlert);
  await overwriteUserProfileInStorage(userProfile);

  // Clear inputs
  document.getElementById("alert-hours").value = "";
  document.getElementById("alert-minutes").value = "";
  document.getElementById("alert-seconds").value = "";
}

export function populateAlerts(userProfile) {
  const activeAlerts = document.getElementById("active-alerts");
  const alerts = userProfile.preferences.alerts || [];

  // Clear existing alerts
  activeAlerts.innerHTML = "";
  // Populate active alerts
  alerts.forEach((alert) => {
    const alertElement = createAlertElement(alert, userProfile);
    activeAlerts.appendChild(alertElement);
  });
}

// Function to convert hours, minutes, and seconds to total seconds
function convertToSeconds(hours, minutes, seconds) {
  return hours * 3600 + minutes * 60 + seconds;
}

// Function to format time for display
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

// Function to create an alert element
function createAlertElement(alert, userProfile) {
  const alertElement = document.createElement("div");
  alertElement.className =
    "flex items-center justify-between rounded-md overflow-hidden";
  alertElement.style.backgroundColor = alert.alert_string;

  // Time section with white background
  const timeSection = document.createElement("div");
  timeSection.className = "bg-white px-3 py-2 flex items-center w-[17%]";

  const timeText = document.createElement("span");
  timeText.className = "text-sm font-medium";
  timeText.textContent = formatTime(alert.time_in_seconds);

  timeSection.appendChild(timeText);

  // Delete button
  const deleteButton = document.createElement("button");
  deleteButton.className = "text-white hover:text-gray-200 px-3 py-2";
  deleteButton.innerHTML = "&times;";
  deleteButton.onclick = async () => {
    // Remove from DOM
    alertElement.remove();

    // Remove from storage
    if (
      userProfile &&
      userProfile.preferences &&
      userProfile.preferences.alerts
    ) {
      // Find and remove the alert by matching its properties
      userProfile.preferences.alerts = userProfile.preferences.alerts.filter(
        (existingAlert) =>
          existingAlert.type !== alert.type ||
          existingAlert.time_in_seconds !== alert.time_in_seconds ||
          existingAlert.alert_string !== alert.alert_string
      );
      await overwriteUserProfileInStorage(userProfile);
    }
  };

  alertElement.appendChild(timeSection);
  alertElement.appendChild(deleteButton);

  return alertElement;
}
