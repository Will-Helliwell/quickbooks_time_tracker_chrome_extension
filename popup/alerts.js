import { overwriteUserProfileInStorage } from "/popup/user.js";

// Function to add a new alert
export async function addNewAlert(userProfile) {
  const newAlertHours =
    parseInt(document.getElementById("alert-hours").value) || 0;
  const newAlerMinutes =
    parseInt(document.getElementById("alert-minutes").value) || 0;
  const newAlerSeconds =
    parseInt(document.getElementById("alert-seconds").value) || 0;
  const newAlertType = document.getElementById("alert-type").value;
  const color = document.getElementById("alert-color").value;
  const sound = document.getElementById("alert-sound").value;
  const selectedClient = document.getElementById("alert-client").value;

  const newAlertTimeInSeconds = convertToSeconds(
    newAlertHours,
    newAlerMinutes,
    newAlerSeconds
  );

  // Check if user deliberately entered zero (at least one field has a value)
  const hasTimeInput =
    document.getElementById("alert-hours").value !== "" ||
    document.getElementById("alert-minutes").value !== "" ||
    document.getElementById("alert-seconds").value !== "";
  if (newAlertTimeInSeconds === 0 && !hasTimeInput) {
    alert(
      "Please enter a time for your new alert (set to 0 for an 'overtime' alert."
    );
    return;
  }

  // Check for conflicting alerts with new client-aware logic
  const conflictMessage = checkForAlertConflicts(
    userProfile.preferences.alerts,
    newAlertType,
    newAlertTimeInSeconds,
    selectedClient
  );
  if (conflictMessage) {
    alert(conflictMessage);
    return;
  }

  // Parse sound selection to determine type and asset reference
  let alertTypeToUse = newAlertType;
  let assetReference = "";
  let displayName = "";

  if (newAlertType === "badge") {
    assetReference = color;
  } else if (newAlertType === "sound") {
    // Parse the sound selection to determine if it's default or custom
    const soundParts = sound.split(":");
    if (soundParts[0] === "default") {
      alertTypeToUse = "sound_default";
      assetReference = soundParts[1]; // filename
      displayName = soundParts[1]
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
    } else if (soundParts[0] === "custom") {
      alertTypeToUse = "sound_custom";
      assetReference = soundParts[1]; // IndexedDB ID
      // Get display name from the custom sound data
      try {
        const { getAudioFile } = await import("/shared/audioStorage.js");
        const audioRecord = await getAudioFile(soundParts[1]);
        displayName = audioRecord ? audioRecord.name : soundParts[1];
      } catch (error) {
        console.error("Error getting custom sound name:", error);
        displayName = soundParts[1];
      }
    }
  }

  // Create jobcodeIds array - empty for "All clients", or array with selected ID
  const jobcodeIds = selectedClient ? [selectedClient] : [];

  const newAlert = {
    type: alertTypeToUse,
    time_in_seconds: newAlertTimeInSeconds,
    asset_reference: assetReference,
    jobcode_ids: jobcodeIds,
  };

  // Add display_name for sound alerts
  if (alertTypeToUse.startsWith("sound")) {
    newAlert.display_name = displayName;
  }

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
  if (seconds === 0) {
    return "0h 0m 0s (Overtime)";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

// Function to get client display text for an alert
function getClientDisplayText(alert, userProfile) {
  // Handle legacy alerts that don't have jobcode_ids
  if (!alert.jobcode_ids || !Array.isArray(alert.jobcode_ids)) {
    return "for all clients";
  }

  // If empty array, it's "All clients"
  if (alert.jobcode_ids.length === 0) {
    return "for all clients";
  }

  // If single client, show the client name
  if (alert.jobcode_ids.length === 1) {
    const jobcodeId = alert.jobcode_ids[0];
    const jobcode = userProfile.jobcodes && userProfile.jobcodes[jobcodeId];

    if (jobcode) {
      const clientName = jobcode.parent_path_name
        ? jobcode.parent_path_name + jobcode.name
        : jobcode.name;
      return `for ${clientName}`;
    } else {
      return "for an unknown client";
    }
  }

  // If multiple clients (future functionality)
  return `(${alert.jobcode_ids.length} clients)`;
}

// Function to create an alert element
function createAlertElement(alert, userProfile) {
  const alertElement = document.createElement("div");
  alertElement.className =
    "flex items-center justify-between rounded-md overflow-hidden border border-black/10";

  // Set background color
  if (alert.type === "badge") {
    alertElement.style.backgroundColor = alert.asset_reference;
  } else {
    alertElement.style.backgroundColor = "#FFFFFF"; // white
  }

  // Time section with white background
  const timeSection = document.createElement("div");
  timeSection.className =
    "bg-white dark:bg-gray-700 px-3 py-2 flex items-center w-[17%]";

  const timeText = document.createElement("span");
  timeText.className = "text-sm font-medium";
  timeText.textContent = formatTime(alert.time_in_seconds);

  timeSection.appendChild(timeText);

  // Alert type indicator
  const typeIndicator = document.createElement("span");
  typeIndicator.className = "text-sm font-medium ml-2";

  let displayText = "";
  if (alert.type === "badge") {
    displayText = "Badge";
  } else if (alert.type === "sound_default" || alert.type === "sound_custom") {
    // Use display_name if available, otherwise fallback to formatted asset_reference
    const soundName =
      alert.display_name ||
      (alert.asset_reference || "Unknown")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
    displayText = `Sound (${soundName})`;
  } else if (alert.type === "notification") {
    displayText = "Chrome Notification";
  } else {
    displayText = alert.type || "Unknown";
  }

  // Add client information to display text
  const clientText = getClientDisplayText(alert, userProfile);
  typeIndicator.textContent = `${displayText} ${clientText}`;

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
          existingAlert.asset_reference !== alert.asset_reference
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
 * Includes both pre-packaged sounds from /sounds directory and custom uploaded sounds
 *
 * @function
 * @returns {Promise<void>}
 */
export async function populateSoundSelector() {
  const soundSelector = document.getElementById("alert-sound");
  soundSelector.innerHTML = ""; // Clear existing options

  try {
    // Add pre-packaged sounds
    await addPrePackagedSounds(soundSelector);

    // Add custom sounds
    await addCustomSounds(soundSelector);
  } catch (error) {
    console.error("Error populating sound selector:", error);
    // Fallback to a default sound if there's an error
    const option = document.createElement("option");
    option.value = "default:eastern_whip";
    option.textContent = "Eastern Whip";
    soundSelector.appendChild(option);
  }
}

/**
 * Add pre-packaged sounds to the selector dropdown
 * @param {HTMLSelectElement} soundSelector - The select element to populate
 */
async function addPrePackagedSounds(soundSelector) {
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

    // Add header for pre-packaged sounds if we have both types
    const customSounds = await getCustomSounds();
    if (customSounds.length > 0) {
      const headerOption = document.createElement("option");
      headerOption.disabled = true;
      headerOption.textContent = "── Pre-packaged Sounds ──";
      soundSelector.appendChild(headerOption);
    }

    // Add each pre-packaged sound file as an option
    soundFiles.forEach((soundFile) => {
      const option = document.createElement("option");
      option.value = `default:${soundFile}`; // Prefix to identify type
      option.textContent = soundFile
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      soundSelector.appendChild(option);
    });
  } catch (error) {
    console.error("Error reading pre-packaged sounds:", error);
  }
}

/**
 * Add custom uploaded sounds to the selector dropdown
 * @param {HTMLSelectElement} soundSelector - The select element to populate
 */
async function addCustomSounds(soundSelector) {
  try {
    const customSounds = await getCustomSounds();

    if (customSounds.length > 0) {
      // Add header for custom sounds
      const headerOption = document.createElement("option");
      headerOption.disabled = true;
      headerOption.textContent = "── Custom Sounds ──";
      soundSelector.appendChild(headerOption);

      // Sort custom sounds alphabetically by name
      customSounds.sort((a, b) => a.name.localeCompare(b.name));

      // Add each custom sound as an option
      customSounds.forEach((audioFile) => {
        const option = document.createElement("option");
        option.value = `custom:${audioFile.id}`; // Prefix to identify type
        option.textContent = audioFile.name
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
        soundSelector.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error reading custom sounds:", error);
  }
}

/**
 * Get custom sounds from IndexedDB
 * @returns {Promise<Array>} Array of custom audio files
 */
async function getCustomSounds() {
  try {
    const { getAllAudioFiles } = await import("/shared/audioStorage.js");
    return await getAllAudioFiles();
  } catch (error) {
    console.error("Error getting custom sounds:", error);
    return [];
  }
}

/**
 * Populates the client selector dropdown with all available jobcodes
 * @param {Object} userProfile - The user profile containing jobcodes
 */
export function populateClientSelector(userProfile) {
  const clientSelector = document.getElementById("alert-client");
  if (!clientSelector) return;

  // Clear existing options except the default "All clients"
  clientSelector.innerHTML = '<option value="">All clients</option>';

  try {
    let jobcodes = Object.values(userProfile.jobcodes) || [];

    // Filter out jobcodes with children as these cannot have timesheets assigned
    jobcodes = jobcodes.filter((jobcode) => !jobcode.has_children);

    // Sort jobcodes by their full name (parent_path_name + name)
    jobcodes.sort((a, b) => {
      const nameA = (a.parent_path_name || "") + a.name;
      const nameB = (b.parent_path_name || "") + b.name;
      return nameA.localeCompare(nameB);
    });

    // Add each jobcode as an option
    jobcodes.forEach((jobcode) => {
      const option = document.createElement("option");
      option.value = jobcode.id;
      option.textContent = jobcode.parent_path_name
        ? jobcode.parent_path_name + jobcode.name
        : jobcode.name;
      clientSelector.appendChild(option);
    });
  } catch (error) {
    console.error("Error populating client selector:", error);
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

// Helper function to check if alert types match
function alertTypesMatch(storedAlertType, formAlertType) {
  // For sound alerts, stored type could be 'sound_default' or 'sound_custom'
  // but form type is just 'sound'
  if (formAlertType === "sound") {
    return storedAlertType.includes("sound");
  }
  // For other types (badge, notification), they should match exactly
  return storedAlertType === formAlertType;
}

/**
 * Checks for conflicting alerts with client-aware logic
 * @param {Array} alerts - Array of existing alerts
 * @param {string} newAlertType - The form alert type (badge, sound, notification)
 * @param {number} newAlertTimeInSeconds - The alert time in seconds
 * @param {string} selectedClient - The selected client ID (empty string for "All clients")
 * @returns {string|null} - Error message if conflict exists, null if no conflict
 */
function checkForAlertConflicts(
  alerts,
  newAlertType,
  newAlertTimeInSeconds,
  selectedClient
) {
  if (!alerts) return null;

  const isNewAlertForAllClients = !selectedClient;

  // Check if there's already an "all clients" alert with same type and time
  const existingAllClientsAlert = alerts.find(
    (alert) =>
      alertTypesMatch(alert.type, newAlertType) &&
      alert.time_in_seconds === newAlertTimeInSeconds &&
      (!alert.jobcode_ids || alert.jobcode_ids.length === 0)
  );

  if (existingAllClientsAlert) {
    return "You already have an alert of this type and this time for all clients. Please delete this alert first if you want to add a client-specific one.";
  }

  // If new alert is client-specific, check for any alert of the same type and time
  if (!isNewAlertForAllClients) {
    const clashingAlert = alerts.find(
      (alert) =>
        alertTypesMatch(alert.type, newAlertType) &&
        alert.time_in_seconds === newAlertTimeInSeconds
    );

    if (clashingAlert) {
      return "You already have a client-specific alert of this type and this time. Please delete this alert first before adding a new one.";
    }
  }

  // If new alert is for all clients, check for any alerts of same type and time
  if (isNewAlertForAllClients) {
    const existingClientSpecificAlert = alerts.find(
      (alert) =>
        alertTypesMatch(alert.type, newAlertType) &&
        alert.time_in_seconds === newAlertTimeInSeconds
    );

    if (existingClientSpecificAlert) {
      return "You already have a client-specific alert of this type and this time. Please delete this alert first before adding a new one.";
    }
  }

  return null; // No conflicts found
}
