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
    "flex items-center justify-between p-2 bg-white border rounded-md";
  alertElement.style.borderLeft = `4px solid ${alert.color}`;

  const timeText = document.createElement("span");
  timeText.textContent = formatTime(alert.timeInSeconds);

  const colorPreview = document.createElement("div");
  colorPreview.className = "w-4 h-4 rounded-full";
  colorPreview.style.backgroundColor = alert.color;

  const deleteButton = document.createElement("button");
  deleteButton.className = "text-red-500 hover:text-red-700";
  deleteButton.innerHTML = "&times;";
  deleteButton.onclick = () => {
    alertElement.remove();
    // TODO: Remove from storage
  };

  alertElement.appendChild(timeText);
  alertElement.appendChild(colorPreview);
  alertElement.appendChild(deleteButton);

  return alertElement;
}

// Function to add a new alert
async function addNewAlert() {
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
    timeInSeconds,
    color,
  };

  // Add to DOM
  const activeAlerts = document.getElementById("active-alerts");
  activeAlerts.appendChild(createAlertElement(alert));

  // TODO: Save to storage
  // const userProfile = await loadOrFetchUserProfile();
  // if (!userProfile.alerts) {
  //     userProfile.alerts = [];
  // }
  // userProfile.alerts.push(alert);
  // await overwriteUserProfileInStorage(userProfile);

  // Clear inputs
  document.getElementById("alert-hours").value = "";
  document.getElementById("alert-minutes").value = "";
  document.getElementById("alert-seconds").value = "";
}

// Initialize alerts functionality
document.addEventListener("DOMContentLoaded", () => {
  const addAlertButton = document.getElementById("add-alert");
  if (addAlertButton) {
    addAlertButton.addEventListener("click", addNewAlert);
  }

  // TODO: Load existing alerts from storage
  // const userProfile = await loadOrFetchUserProfile();
  // if (userProfile.alerts) {
  //     userProfile.alerts.forEach(alert => {
  //         const activeAlerts = document.getElementById('active-alerts');
  //         activeAlerts.appendChild(createAlertElement(alert));
  //     });
  // }
});
