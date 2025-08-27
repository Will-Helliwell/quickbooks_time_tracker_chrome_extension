import { overwriteUserProfileInStorage } from "/popup/user.js";

// Function to add a new alert
export async function addNewAlert(userProfile) {
  const isOvertimeAlert = document.getElementById("overtime-alert").checked;
  const hours = parseInt(document.getElementById("alert-hours").value) || 0;
  const minutes = parseInt(document.getElementById("alert-minutes").value) || 0;
  const seconds = parseInt(document.getElementById("alert-seconds").value) || 0;
  const alertType = document.getElementById("alert-type").value;
  const color = document.getElementById("alert-color").value;
  const sound = document.getElementById("alert-sound").value;

  const timeInSeconds = isOvertimeAlert
    ? 0
    : convertToSeconds(hours, minutes, seconds);

  if (!isOvertimeAlert && timeInSeconds === 0) {
    alert("Please enter a valid time for your new alert.");
    return;
  }

  // Check for existing alert with same time and type
  if (userProfile.preferences.alerts) {
    const existingAlert = userProfile.preferences.alerts.find(
      (alert) =>
        alert.type === alertType && alert.time_in_seconds === timeInSeconds
    );

    if (existingAlert) {
      if (isOvertimeAlert) {
        alert("An overtime alert already exists. Please remove it first.");
      } else {
        alert(
          `An alert already exists for ${formatTime(
            timeInSeconds
          )}. Please choose a different time.`
        );
      }
      return;
    }
  }

  const newAlert = {
    type: alertType,
    time_in_seconds: timeInSeconds,
    alert_string:
      alertType === "badge" ? color : alertType === "sound" ? sound : "",
  };

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

  // Re-populate alerts to maintain sorted order
  populateAlerts(userProfile);

  // Clear inputs
  document.getElementById("alert-hours").value = "";
  document.getElementById("alert-minutes").value = "";
  document.getElementById("alert-seconds").value = "";
}

export function populateAlerts(userProfile) {
  const activeAlerts = document.getElementById("active-alerts");
  const alerts = userProfile.preferences.alerts || [];

  // Sort by time_in_seconds ascending
  const sortedAlerts = alerts.sort(
    (a, b) => a.time_in_seconds - b.time_in_seconds
  );

  // Clear existing alerts
  activeAlerts.innerHTML = "";
  // Populate active alerts
  sortedAlerts.forEach((alert) => {
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
    "flex items-center justify-between rounded-md overflow-hidden border border-black/10";

  // Set background color
  if (alert.type === "badge") {
    alertElement.style.backgroundColor = alert.alert_string;
  } else {
    alertElement.style.backgroundColor = "#FFFFFF"; // white
  }

  // Time section with white background
  const timeSection = document.createElement("div");
  timeSection.className =
    "bg-white dark:bg-gray-700 px-3 py-2 flex items-center w-[17%]";

  const timeText = document.createElement("span");
  timeText.className = "text-sm font-medium";
  timeText.textContent =
    alert.time_in_seconds === 0
      ? "Overtime"
      : formatTime(alert.time_in_seconds);

  timeSection.appendChild(timeText);

  // Alert type indicator
  const typeIndicator = document.createElement("span");
  typeIndicator.className = "text-sm font-medium ml-2";
  typeIndicator.textContent =
    alert.type === "badge"
      ? "Badge"
      : alert.type === "sound"
      ? `Sound (${alert.alert_string
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())})`
      : "Chrome Notification";

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
  alertElement.appendChild(typeIndicator);
  alertElement.appendChild(deleteButton);

  return alertElement;
}

/**
 * Populates the sound selector dropdown with all available sound files
 *
 * This function reads the sounds directory and populates the sound selector
 * with all available sound files. Each option's value is the filename without extension,
 * and the display text is the filename with underscores replaced by spaces and capitalized.
 *
 * @function
 * @returns {Promise<void>}
 */
async function populateSoundSelector() {
  const soundSelector = document.getElementById("alert-sound");
  soundSelector.innerHTML = ""; // Clear existing options

  try {
    // Get the sounds directory entry
    const soundsDir = await new Promise((resolve, reject) => {
      chrome.runtime.getPackageDirectoryEntry((root) => {
        root.getDirectory("sounds", {}, (dir) => resolve(dir), reject);
      });
    });

    // Read all files in the directory
    const soundFiles = await new Promise((resolve, reject) => {
      const reader = soundsDir.createReader();
      const files = [];

      function readEntries() {
        reader.readEntries((entries) => {
          if (entries.length) {
            entries.forEach((entry) => {
              if (entry.isFile && entry.name.endsWith(".mp3")) {
                files.push(entry.name.replace(".mp3", ""));
              }
            });
            readEntries(); // Continue reading if there are more entries
          } else {
            resolve(files);
          }
        }, reject);
      }

      readEntries();
    });

    // Sort the files alphabetically
    soundFiles.sort();

    // Add each sound file as an option
    soundFiles.forEach((soundFile) => {
      const option = document.createElement("option");
      option.value = soundFile;
      option.textContent = soundFile
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      soundSelector.appendChild(option);
    });
  } catch (error) {
    console.error("Error reading sounds directory:", error);
    // Fallback to a default sound if there's an error
    const option = document.createElement("option");
    option.value = "eastern_whip";
    option.textContent = "Eastern Whip";
    soundSelector.appendChild(option);
  }
}

export function initializeAlertTypeSelector() {
  const alertTypeSelect = document.getElementById("alert-type");
  const colorPickerContainer = document.getElementById(
    "color-picker-container"
  );
  const soundSelectorContainer = document.getElementById(
    "sound-selector-container"
  );

  // Populate sound selector when initializing
  populateSoundSelector();

  // Create a placeholder container for notification type
  const placeholderContainer = document.createElement("div");
  placeholderContainer.id = "notification-placeholder";
  placeholderContainer.className =
    "w-24 h-8 border rounded-md p-1 notification-placeholder";
  placeholderContainer.style.display = "none";
  colorPickerContainer.parentNode.insertBefore(
    placeholderContainer,
    colorPickerContainer.nextSibling
  );

  alertTypeSelect.addEventListener("change", () => {
    if (alertTypeSelect.value === "badge") {
      colorPickerContainer.classList.remove("hidden");
      soundSelectorContainer.classList.add("hidden");
      placeholderContainer.style.display = "none";
    } else if (alertTypeSelect.value === "sound") {
      colorPickerContainer.classList.add("hidden");
      soundSelectorContainer.classList.remove("hidden");
      placeholderContainer.style.display = "none";
    } else {
      // For notification type, hide both containers and show placeholder
      colorPickerContainer.classList.add("hidden");
      soundSelectorContainer.classList.add("hidden");
      placeholderContainer.style.display = "block";
    }
  });
}
