import { overwriteUserProfileInStorage } from "/popup/user.js";

// Function to add a new alert
export async function addNewAlert(userProfile) {
  const hours = parseInt(document.getElementById("alert-hours").value) || 0;
  const minutes = parseInt(document.getElementById("alert-minutes").value) || 0;
  const seconds = parseInt(document.getElementById("alert-seconds").value) || 0;
  const color = document.getElementById("alert-color").value;

  const timeInSeconds = convertToSeconds(hours, minutes, seconds);

  if (timeInSeconds === 0) {
    alert("Please enter a valid time");
    return;
  }

  const alert = {
    type: "badge_colour",
    time_in_seconds: timeInSeconds,
    alert_string: color,
  };

  // Add to DOM
  const activeAlerts = document.getElementById("active-alerts");
  activeAlerts.appendChild(createAlertElement(alert));

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

  userProfile.preferences.alerts.push(alert);

  await overwriteUserProfileInStorage(userProfile);

  // Clear inputs
  document.getElementById("alert-hours").value = "";
  document.getElementById("alert-minutes").value = "";
  document.getElementById("alert-seconds").value = "";
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
function createAlertElement(alert) {
  const alertElement = document.createElement("div");
  alertElement.className =
    "flex items-center justify-between rounded-md overflow-hidden";
  alertElement.style.backgroundColor = alert.alert_string;

  // Time section with white background
  const timeSection = document.createElement("div");
  timeSection.className = "bg-white px-3 py-2 flex items-center";

  const timeText = document.createElement("span");
  timeText.className = "text-sm font-medium";
  timeText.textContent = formatTime(alert.time_in_seconds);

  timeSection.appendChild(timeText);

  // Delete button
  const deleteButton = document.createElement("button");
  deleteButton.className = "text-white hover:text-gray-200 px-3 py-2";
  deleteButton.innerHTML = "&times;";
  deleteButton.onclick = () => {
    alertElement.remove();
    // TODO: Remove from storage
  };

  alertElement.appendChild(timeSection);
  alertElement.appendChild(deleteButton);

  return alertElement;
}

// Initialize alerts functionality
// document.addEventListener("DOMContentLoaded", () => {
//   const addAlertButton = document.getElementById("add-alert");
//   if (addAlertButton) {
//     addAlertButton.addEventListener("click", addNewAlert);
//   }
// TODO: Load existing alerts from storage
// const userProfile = await loadOrFetchUserProfile();
// if (userProfile.alerts) {
//     userProfile.alerts.forEach(alert => {
//         const activeAlerts = document.getElementById('active-alerts');
//         activeAlerts.appendChild(createAlertElement(alert));
//     });
// }
// });
