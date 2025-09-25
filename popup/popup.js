import { authenticateUser } from "/popup/auth.js";
import { getLoginDetailsFromLocalStorage } from "/popup/loginDetails.js";
import {
  updateUserProfileFromAPI,
  getUserProfileFromStorage,
  loadOrFetchUserProfile,
  overwriteUserProfileInStorage,
} from "/popup/user.js";
import {
  updateSecondsAssigned,
  updateJobcodesAndTimesheets,
} from "/popup/jobcodes.js";
import { getActiveRecordingFromLocalStorage } from "/popup/activeRecording.js";
import { logout } from "/popup/auth.js";
import {
  startLiveCountdown,
  startLiveCountup,
  stopAllTimers,
} from "/popup/timer.js";
import {
  addNewAlert,
  populateAlerts,
  initializeAlertTypeSelector,
  populateClientSelector,
} from "/popup/alerts.js";
import { initializeAudioUpload } from "/popup/audioUpload.js";
import { getCurrentDate, isDateInCurrentMonth } from "/shared/dateUtils.js";
import {
  formatSecondsToTime,
  formatStartEndTime,
  formatSecondsToHoursDecimal,
} from "/shared/formatting.js";
import { AppState } from "/shared/appState.js";

document.addEventListener("DOMContentLoaded", () => {
  handlePopupOpen();
});

/**
 * This is the main handler function that runs when the popup is opened.
 * It initializes the user profile and sets up the necessary event listeners.
 * @async
 * @function
 */
async function handlePopupOpen() {
  let userProfile = {};
  const loginScreen = document.getElementById("login-screen");
  const loginButton = document.getElementById("login-button");
  const clientSecretInput = document.getElementById("client-secret");
  const redirectUrlContainer = document.getElementById(
    "redirect-url-container"
  );
  const loadingSpinner = document.getElementById("loading-spinner");
  const mainContent = document.getElementById("main-content");
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  // If the user is already logged in, hide the login section and load their profile
  const loginDetails = await getLoginDetailsFromLocalStorage();
  if (
    loginDetails.authToken &&
    loginDetails.currentUserId &&
    loginDetails.authTokenExpiryTimestamp &&
    new Date(loginDetails.authTokenExpiryTimestamp) > new Date()
  ) {
    loginScreen.classList.add("hidden");
    mainContent.classList.remove("hidden");
    userProfile = await loadOrFetchUserProfile(loginDetails.currentUserId);
    AppState.setUserProfile(userProfile);
    await updateUIWithUserProfile(userProfile);
  }

  // Handle login button click
  loginButton.addEventListener("click", async () => {
    loginButton.classList.add("hidden");
    clientSecretInput.classList.add("hidden");
    redirectUrlContainer.classList.add("hidden");
    loadingSpinner.classList.remove("hidden");
    const isAuthenticated = await authenticateUser();
    loginButton.classList.remove("hidden");
    clientSecretInput.classList.remove("hidden");
    redirectUrlContainer.classList.remove("hidden");
    loadingSpinner.classList.add("hidden");
    if (isAuthenticated) {
      loginScreen.classList.add("hidden");
      mainContent.classList.remove("hidden");
      userProfile = await updateUserProfileFromAPI();
      await updateJobcodesAndTimesheets();
      userProfile = await getUserProfileFromStorage(userProfile.id); // refresh user profile in memory in case jobcodes/timesheets have updated
      AppState.setUserProfile(userProfile);
      await updateUIWithUserProfile(userProfile);
    }
  });

  // Handle logout
  document.getElementById("logout-button").addEventListener("click", () => {
    logout();
  });

  // Handle tab switching
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tabButtons.forEach((btn) =>
        btn.classList.remove("text-black", "font-bold")
      );
      button.classList.add("text-black", "font-bold");

      const targetTab = button.getAttribute("data-tab");
      tabContents.forEach((content) => {
        content.classList.toggle("hidden", content.id !== targetTab);
      });
    });
  });

  // Handle add alert button click
  const addAlertButton = document.getElementById("add-alert");
  if (addAlertButton) {
    addAlertButton.addEventListener("click", () => addNewAlert());
  }
  initializeAlertTypeSelector();

  // Initialize audio upload functionality
  initializeAudioUpload();

  // Handle back to clients button click
  document.getElementById("back-to-clients").addEventListener("click", () => {
    hideClientInfoView();
    showMyClientsView();
  });
}

/**
 * Updates the UI all information from the userProfile object
 *
 * This function updates the user interface by rendering the user's profile data,
 * including job codes and client information. It also includes a placeholder
 * for re-rendering the frontend based on the currently active recording.
 *
 * @async
 * @function
 * @param {Object} userProfile - The user's profile data.
 * @param {Object} userProfile.jobcodes - An object containing job codes associated with the user.
 * @returns {Promise<void>} Resolves when the UI update is complete.
 */
async function updateUIWithUserProfile(userProfile) {
  updateUserUI(userProfile);

  // Set the favorites toggle to checked by default
  document.getElementById("favorites-toggle").checked = true;

  // Set the correct tab styling
  document.querySelectorAll(".tab-button").forEach((button) => {
    if (button.getAttribute("data-tab") === "clients-screen") {
      button.classList.add("text-black", "font-bold");
    } else {
      button.classList.remove("text-black", "font-bold");
    }
  });

  populateAlerts(userProfile);
  populateClientSelector(userProfile);

  renderAllClientsTable(userProfile);
}

/**
 * Updates the styling of a remaining time element based on the remaining seconds.
 * This function applies different color classes to indicate the urgency of the remaining time:
 * - Red and bold when time is completely depleted (0 seconds)
 * - Red when less than 10% of total time remains
 * - Orange when less than 25% of total time remains
 * - Green when more than 25% of total time remains
 *
 * @param {HTMLElement} element - The HTML element to style, typically a div with class 'job-remaining'
 * @param {number} remainingSeconds - The number of seconds remaining for the task
 * @param {number} totalSeconds - The total number of seconds allocated for the task, used to calculate percentage thresholds
 * @returns {void}
 *
 */
function updateRemainingTimeStyle(element, remainingSeconds, totalSeconds) {
  element.className = "job-remaining p-2 w-28 text-left";

  // do not highlight if no limit is assigned
  if (totalSeconds == null) {
    return;
  }

  if (remainingSeconds === 0) {
    element.classList.add("text-red-600", "font-bold");
  } else if (remainingSeconds < totalSeconds * 0.1) {
    element.classList.add("text-red-600");
  } else if (remainingSeconds < totalSeconds * 0.25) {
    element.classList.add("text-orange-500");
  } else {
    element.classList.add("text-green-600");
  }
}

async function updateUIWithActiveRecording(userProfile) {
  const activeRecording = await getActiveRecordingFromLocalStorage();
  const activeRecordingOnTheClock = activeRecording.on_the_clock;
  const activeRecordingJobcodeId = activeRecording.jobcode_id;
  const activeRecordingShiftSeconds = activeRecording.shift_seconds;
  const activeRecordingApiCallTimestamp = activeRecording.api_call_timestamp;

  // return all rows to default
  const allJobRows = document.querySelectorAll(".job-row");
  allJobRows.forEach((row) => {
    row.classList.remove("bg-blue-100");
    const nameField = row.querySelector(".job-name");
    nameField.classList.remove("text-blue-600", "font-bold");
  });

  // if there is an active recording
  if (activeRecordingOnTheClock) {
    // Find the job row container using the jobcode ID
    const jobRow = document.querySelector(
      `.job-row[data-jobcode-id="${activeRecordingJobcodeId}"]`
    );
    if (jobRow) {
      // get details for currently active jobcode
      const activeJobcode = userProfile.jobcodes[activeRecordingJobcodeId];
      const activeJobcodeSecondsAssigned = activeJobcode.seconds_assigned;
      const activeJobcodeSecondsCompletedThisMonth =
        calculateSecondsCompletedThisMonth(activeJobcode);

      const activeJobcodeSecondsRemaining =
        activeJobcodeSecondsAssigned - activeJobcodeSecondsCompletedThisMonth;

      // grab the relevant elements
      const remainingElement = jobRow.querySelector(".job-remaining");
      const completedElement = jobRow.querySelector(".job-completed");
      const timeRemainingDisplayHmsSpan = remainingElement.querySelector(
        "[data-time-format-h-m-s]"
      );
      const timeRemainingDisplayHoursDecimalSpan =
        remainingElement.querySelector("[data-time-format-hours-decimal]");
      const timeCompletedDisplayHmsSpan = completedElement.querySelector(
        "[data-time-format-h-m-s]"
      );
      const timeCompletedDisplayHoursDecimalSpan =
        completedElement.querySelector("[data-time-format-hours-decimal]");

      // highlight the row
      jobRow.classList.add("bg-blue-100");
      const nameField = jobRow.querySelector(".job-name");
      nameField.classList.add("text-blue-600", "font-bold");

      // Calculate total time spent on the clock for the current session
      const now = new Date();
      const apiCallTime = new Date(activeRecordingApiCallTimestamp);
      const elapsedSeconds = Math.floor((now - apiCallTime) / 1000);
      const totalCurrentSessionSeconds =
        activeRecordingShiftSeconds + elapsedSeconds;

      // Calculate new remaining time by subtracting current session time
      const newRemainingSeconds = Math.max(
        0,
        activeJobcodeSecondsRemaining - totalCurrentSessionSeconds
      );

      // Calculate new completed time by adding current session time
      const newCompletedSeconds =
        activeJobcodeSecondsCompletedThisMonth + totalCurrentSessionSeconds;

      // Update the time displays
      timeRemainingDisplayHmsSpan.textContent =
        formatSecondsToTime(newRemainingSeconds);
      timeRemainingDisplayHoursDecimalSpan.textContent =
        formatSecondsToHoursDecimal(newRemainingSeconds);
      timeCompletedDisplayHmsSpan.textContent =
        formatSecondsToTime(newCompletedSeconds);
      timeCompletedDisplayHoursDecimalSpan.textContent =
        formatSecondsToHoursDecimal(newCompletedSeconds);

      // start counting down the remaining time
      startLiveCountdown(newRemainingSeconds, (remainingSeconds) => {
        timeRemainingDisplayHmsSpan.textContent =
          formatSecondsToTime(remainingSeconds);
        timeRemainingDisplayHoursDecimalSpan.textContent =
          formatSecondsToHoursDecimal(remainingSeconds);
        updateRemainingTimeStyle(
          remainingElement,
          remainingSeconds,
          activeJobcodeSecondsAssigned
        );
      });

      // start counting up the completed time
      startLiveCountup(newCompletedSeconds, (completedSeconds) => {
        timeCompletedDisplayHmsSpan.textContent =
          formatSecondsToTime(completedSeconds);
        timeCompletedDisplayHoursDecimalSpan.textContent =
          formatSecondsToHoursDecimal(completedSeconds);
      });

      // Update styling
      updateRemainingTimeStyle(
        remainingElement,
        newRemainingSeconds,
        activeJobcodeSecondsAssigned
      );
    }
  } else {
    // If there's no active recording, stop all timers
    stopAllTimers();
  }
}

/**
 * Updates the DOM with user data.
 * @param {object} user The user profile object.
 */
function updateUserUI(user) {
  const userFullName = `${user.first_name} ${user.last_name}`;
  const userInitials = `${user.first_name[0]}${user.last_name[0]}`;

  document.getElementById("user-full-name").textContent = userFullName;
  document.getElementById("user-company").textContent = user.company_name;
  document.getElementById("user-initials").textContent = userInitials;
}

/**
 * Renders the table displaying all clients
 * @param {Object} userProfile - The user profile object containing user and jobcode information
 * @returns {void}
 */
function renderAllClientsTable(userProfile) {
  let jobcodes = Object.values(userProfile.jobcodes) || [];

  // filter out any jobcodes with children as these cannot have timesheets assigned
  jobcodes = jobcodes.filter((jobcode) => !jobcode.has_children);

  // Get favorites filter state
  const showFavoritesOnly = document.getElementById("favorites-toggle").checked;

  // Filter jobcodes if showing favorites only
  if (showFavoritesOnly) {
    jobcodes = jobcodes.filter((jobcode) => jobcode.is_favourite);
  }

  let allClientsTableHtml = `
    <div class="table-container overflow-hidden flex flex-col bg-white dark:bg-gray-700 shadow-md rounded-lg">
      <!-- Fixed header -->
      <div id="all-clients-table-header" class="bg-gray-200 dark:bg-gray-600 flex w-full">
        <div class="p-2 text-left font-semibold w-10 text-gray-800 dark:text-white"></div>
        <div class="p-2 text-left font-semibold flex-1 table-column-name text-gray-800 dark:text-white">Name</div>
        <div class="p-2 text-left font-semibold w-42 table-column-completed text-gray-800 dark:text-white">Completed This Month</div>
        <div class="p-2 text-left font-semibold w-28 table-column-assigned text-gray-800 dark:text-white">Assigned</div>
        <div class="p-2 text-left font-semibold w-28 table-column-remaining text-gray-800 dark:text-white">Remaining</div>
      </div>
      
      <!-- Scrollable body -->
      <div id="all-clients-table-body" class="overflow-y-auto max-h-64 bg-white dark:bg-gray-700">`;

  jobcodes.forEach((jobcode) => {
    const secondsCompletedThisMonth =
      calculateSecondsCompletedThisMonth(jobcode);

    // Display friendly text for null values
    const timeAssignedDisplayHms =
      jobcode.seconds_assigned !== null
        ? formatSecondsToTime(jobcode.seconds_assigned)
        : "No limit";
    const timeAssignedDisplayHoursDecimal =
      jobcode.seconds_assigned !== null
        ? formatSecondsToHoursDecimal(jobcode.seconds_assigned)
        : "No limit";
    const valueClass =
      jobcode.seconds_assigned !== null ? "" : "text-gray-500 italic";

    // Calculate remaining time (only if there's an assigned limit)
    let timeRemainingDisplayHms,
      timeRemainingDisplayHoursDecimal,
      remainingClass,
      remainingSeconds;
    if (jobcode.seconds_assigned !== null) {
      remainingSeconds = Math.max(
        0,
        jobcode.seconds_assigned - secondsCompletedThisMonth
      );
      timeRemainingDisplayHms = formatSecondsToTime(remainingSeconds);
      timeRemainingDisplayHoursDecimal =
        formatSecondsToHoursDecimal(remainingSeconds);

      // Add warning classes if getting low on time
      if (remainingSeconds === 0) {
        remainingClass = "text-red-600 font-bold";
      } else if (remainingSeconds < jobcode.seconds_assigned * 0.1) {
        // Less than 10% remaining
        remainingClass = "text-red-600";
      } else if (remainingSeconds < jobcode.seconds_assigned * 0.25) {
        // Less than 25% remaining
        remainingClass = "text-orange-500";
      } else {
        remainingClass = "text-green-600";
      }
    } else {
      remainingSeconds = null;
      timeRemainingDisplayHms = "∞"; // Infinity symbol for unlimited
      timeRemainingDisplayHoursDecimal = "∞"; // Infinity symbol for unlimited
      remainingClass = "text-gray-500 italic";
    }

    allClientsTableHtml += `
      <div class="job-row flex w-full border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white" data-jobcode-id="${
        jobcode.id
      }">
        <div class="p-2 w-10">
          <button class="favorite-btn ${
            jobcode.is_favourite ? "text-yellow-400" : "text-gray-300"
          } hover:text-yellow-400 focus:outline-none" data-jobcode-id="${
      jobcode.id
    }">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        </div>
        <div class="job-name p-2 flex-1 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors duration-200">${
          jobcode.parent_path_name + jobcode.name
        }</div>
        <div class="job-completed p-2 w-42 text-left" data-completed="${secondsCompletedThisMonth}">
          <span data-time-format-h-m-s>${formatSecondsToTime(
            secondsCompletedThisMonth
          )}</span>
          <span data-time-format-hours-decimal class="hidden">${formatSecondsToHoursDecimal(
            secondsCompletedThisMonth
          )}</span>
        </div>
        <div class="job-assigned-container p-2 w-28 text-left relative group">
          <div class="flex items-center justify-start">
            <span class="job-assigned-value cursor-pointer group-hover:text-blue-600 ${valueClass}"
                  data-value="${
                    jobcode.seconds_assigned !== null
                      ? jobcode.seconds_assigned
                      : ""
                  }">
              <span data-time-format-h-m-s>${timeAssignedDisplayHms}</span>
              <span data-time-format-hours-decimal class="hidden">${timeAssignedDisplayHoursDecimal}</span>
            </span>
            <button class="edit-assigned-btn opacity-0 group-hover:opacity-100 ml-2 text-blue-600 focus:outline-none" data-jobcode-id="${
              jobcode.id
            }">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
          <div class="edit-form hidden absolute right-0 mt-1 bg-white dark:bg-gray-700 p-2 shadow-lg rounded-md z-10 border border-gray-200 dark:border-gray-600" style="min-width: 220px;">
            <div class="mb-2">
              <label class="flex items-center">
                <input type="checkbox" class="limit-checkbox mr-2" ${
                  jobcode.seconds_assigned !== null ? "checked" : ""
                }>
                <span class="text-sm">Set time limit</span>
              </label>
            </div>
            <div class="limit-input-container ${
              jobcode.seconds_assigned === null ? "hidden" : ""
            }">
              <!-- H:M:S Format Input -->
              <div class="flex space-x-2 mb-2" data-time-format-h-m-s>
                <div class="flex-1">
                  <label class="text-xs text-gray-600">Hours</label>
                  <input type="number" min="0" class="hours-input w-full p-1 border rounded text-sm"
                         value="${
                           jobcode.seconds_assigned !== null
                             ? Math.floor(jobcode.seconds_assigned / 3600)
                             : "0"
                         }">
                </div>
                <div class="flex-1">
                  <label class="text-xs text-gray-600">Minutes</label>
                  <input type="number" min="0" max="59" class="minutes-input w-full p-1 border rounded text-sm"
                         value="${
                           jobcode.seconds_assigned !== null
                             ? Math.floor(
                                 (jobcode.seconds_assigned % 3600) / 60
                               )
                             : "0"
                         }">
                </div>
                <div class="flex-1">
                  <label class="text-xs text-gray-600">Seconds</label>
                  <input type="number" min="0" max="59" class="seconds-input w-full p-1 border rounded text-sm"
                         value="${
                           jobcode.seconds_assigned !== null
                             ? jobcode.seconds_assigned % 60
                             : "0"
                         }">
                </div>
              </div>

              <!-- Hours Decimal Format Input -->
              <div class="hidden flex space-x-2 mb-2" data-time-format-hours-decimal>
                <div class="flex-1">
                  <label class="text-xs text-gray-600">Hours (Decimal)</label>
                  <input type="number" min="0" step="0.01" class="hours-decimal-input w-full p-1 border rounded text-sm"
                         value="${
                           jobcode.seconds_assigned !== null
                             ? (jobcode.seconds_assigned / 3600).toFixed(2)
                             : "0"
                         }" placeholder="2.5">
                </div>
              </div>

              <input type="hidden" class="assigned-input" value="${
                jobcode.seconds_assigned !== null
                  ? jobcode.seconds_assigned
                  : "0"
              }">
            </div>
            <div class="flex justify-between">
              <button class="save-assigned-btn px-2 py-1 bg-blue-600 text-white text-xs rounded" data-jobcode-id="${
                jobcode.id
              }">Save</button>
              <button class="cancel-assigned-btn px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded">Cancel</button>
            </div>
          </div>
        </div>
        <div class="job-remaining p-2 w-28 text-left ${remainingClass}" data-remaining="${remainingSeconds}">
          <span data-time-format-h-m-s>${timeRemainingDisplayHms}</span>
          <span data-time-format-hours-decimal class="hidden">${timeRemainingDisplayHoursDecimal}</span>
        </div>
      </div>`;
  });

  allClientsTableHtml += `
      </div>
    </div>`;

  const myClientsTable = document.getElementById("my-clients-table");
  myClientsTable.innerHTML = allClientsTableHtml;

  setupJobcodeTimeAssignmentEditing();
  setupFavoriteButtons();
  setupFavoritesToggle();
  setupJobNameClickListeners();

  updateActiveRecordingUIWithLatestUserProfile();
  initializeColourTheme(userProfile);
}

// Helper function to get time input from H:M:S format in assigned time edit form
function getTimeAssignedInputHms(editForm) {
  const hours = parseInt(editForm.querySelector(".hours-input").value) || 0;
  const minutes = parseInt(editForm.querySelector(".minutes-input").value) || 0;
  const seconds = parseInt(editForm.querySelector(".seconds-input").value) || 0;

  const timeInSeconds = hours * 3600 + minutes * 60 + seconds;
  return timeInSeconds;
}

// Helper function to get time input from hours decimal format in assigned time edit form
function getTimeAssignedInputHoursDecimal(editForm) {
  const hoursDecimal =
    parseFloat(editForm.querySelector(".hours-decimal-input").value) || 0;
  const timeInSeconds = Math.round(hoursDecimal * 3600);
  return timeInSeconds;
}

/**
 * Sets up all event listeners and functionality for editing jobcode time assignments.
 * This includes:
 * - Toggling edit forms visibility
 * - Managing time limit checkbox state
 * - Validating and converting time inputs (hours, minutes, seconds)
 * - Saving updated time assignments to storage
 *
 * The function handles:
 * 1. Edit button clicks to show/hide edit forms
 * 2. Limit checkbox toggles to enable/disable time input
 * 3. Time input validation and conversion to seconds
 * 4. Save button clicks to persist changes
 */
function setupJobcodeTimeAssignmentEditing() {
  // Click event for edit buttons
  document.querySelectorAll(".edit-assigned-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      // Hide any other open edit forms
      document.querySelectorAll(".edit-form").forEach((form) => {
        if (
          form !==
            e.target
              .closest(".job-assigned-container")
              .querySelector(".edit-form") &&
          !form.classList.contains("hidden")
        ) {
          form.classList.add("hidden");
        }
      });

      // Show this edit form
      const editForm = e.target
        .closest(".job-assigned-container")
        .querySelector(".edit-form");
      editForm.classList.toggle("hidden");

      // Focus on checkbox or input based on current state
      if (editForm.querySelector(".limit-checkbox").checked) {
        const input = editForm.querySelector(".hours-input");
        input.focus();
        input.select();
      }
    });
  });

  // Toggle limit checkbox
  document.querySelectorAll(".limit-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const inputContainer = e.target
        .closest(".edit-form")
        .querySelector(".limit-input-container");
      inputContainer.classList.toggle("hidden", !e.target.checked);

      if (e.target.checked) {
        const editForm = e.target.closest(".edit-form");

        // Get user's time format preference to focus on the correct input
        const userProfile = AppState.getUserProfile();
        const timeDisplayFormat =
          userProfile.preferences.time_display_format || "h:m:s";

        let input;
        if (timeDisplayFormat === "h:m:s") {
          input = editForm.querySelector(".hours-input");
        } else {
          input = editForm.querySelector(".hours-decimal-input");
        }

        if (input) {
          input.focus();
          input.select();
        }
      }
    });
  });

  // Update hidden input when H:M:S time inputs change
  document
    .querySelectorAll(".hours-input, .minutes-input, .seconds-input")
    .forEach((input) => {
      input.addEventListener("input", (e) => {
        const editForm = e.target.closest(".edit-form");
        const hoursInput = editForm.querySelector(".hours-input");
        const minutesInput = editForm.querySelector(".minutes-input");
        const secondsInput = editForm.querySelector(".seconds-input");
        const assignedInput = editForm.querySelector(".assigned-input");

        // Ensure valid ranges
        if (parseInt(minutesInput.value) > 59) minutesInput.value = 59;
        if (parseInt(minutesInput.value) < 0) minutesInput.value = 0;
        if (parseInt(secondsInput.value) > 59) secondsInput.value = 59;
        if (parseInt(secondsInput.value) < 0) secondsInput.value = 0;
        if (parseInt(hoursInput.value) < 0) hoursInput.value = 0;

        // Calculate total seconds using helper function
        const totalSeconds = getTimeAssignedInputHms(editForm);
        assignedInput.value = totalSeconds;
      });
    });

  // Update hidden input when decimal hours input changes
  document.querySelectorAll(".hours-decimal-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const editForm = e.target.closest(".edit-form");
      const assignedInput = editForm.querySelector(".assigned-input");

      // Ensure valid range
      if (parseFloat(input.value) < 0) input.value = 0;

      // Calculate total seconds using helper function
      const totalSeconds = getTimeAssignedInputHoursDecimal(editForm);
      assignedInput.value = totalSeconds;
    });
  });

  // Save button click
  document.querySelectorAll(".save-assigned-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.stopPropagation();
      const jobcodeId = button.getAttribute("data-jobcode-id");
      const editForm = button.closest(".edit-form");
      const limitEnabled = editForm.querySelector(".limit-checkbox").checked;

      // Determine the new value based on checkbox state
      const newValue = limitEnabled
        ? parseInt(editForm.querySelector(".assigned-input").value)
        : null;

      try {
        await updateSecondsAssigned(jobcodeId, newValue);

        // Find the job row container using the jobcode ID
        const jobRow = document.querySelector(
          `.job-row[data-jobcode-id="${jobcodeId}"]`
        );

        // Update the assigned value display
        const assignedSpan = jobRow.querySelector(".job-assigned-value");
        if (newValue !== null) {
          const timeAssignedDisplayHmsSpan = assignedSpan.querySelector(
            "[data-time-format-h-m-s]"
          );
          const timeAssignedDisplayHoursDecimalSpan =
            assignedSpan.querySelector("[data-time-format-hours-decimal]");
          timeAssignedDisplayHmsSpan.textContent =
            formatSecondsToTime(newValue);
          timeAssignedDisplayHoursDecimalSpan.textContent =
            formatSecondsToHoursDecimal(newValue);
          assignedSpan.classList.remove("text-gray-500", "italic");
          assignedSpan.setAttribute("data-value", newValue);
        } else {
          const timeAssignedDisplayHmsSpan = assignedSpan.querySelector(
            "[data-time-format-h-m-s]"
          );
          const timeAssignedDisplayHoursDecimalSpan =
            assignedSpan.querySelector("[data-time-format-hours-decimal]");
          timeAssignedDisplayHmsSpan.textContent = "No limit";
          timeAssignedDisplayHoursDecimalSpan.textContent = "No limit";
          assignedSpan.classList.add("text-gray-500", "italic");
          assignedSpan.setAttribute("data-value", "");
        }

        // Update the remaining value using class selectors
        const remainingElement = jobRow.querySelector(".job-remaining");
        const completedElement = jobRow.querySelector(".job-completed");
        const completedSeconds = parseInt(
          completedElement.getAttribute("data-completed")
        );

        if (newValue !== null) {
          const remainingSeconds = Math.max(0, newValue - completedSeconds);
          const timeRemainingDisplayHmsSpan = remainingElement.querySelector(
            "[data-time-format-h-m-s]"
          );
          const timeRemainingDisplayHoursDecimalSpan =
            remainingElement.querySelector("[data-time-format-hours-decimal]");
          timeRemainingDisplayHmsSpan.textContent =
            formatSecondsToTime(remainingSeconds);
          timeRemainingDisplayHoursDecimalSpan.textContent =
            formatSecondsToHoursDecimal(remainingSeconds);

          // Update styling based on remaining time
          updateRemainingTimeStyle(
            remainingElement,
            remainingSeconds,
            completedSeconds
          );
        } else {
          const timeRemainingDisplayHmsSpan = remainingElement.querySelector(
            "[data-time-format-h-m-s]"
          );
          const timeRemainingDisplayHoursDecimalSpan =
            remainingElement.querySelector("[data-time-format-hours-decimal]");
          timeRemainingDisplayHmsSpan.textContent = "∞";
          timeRemainingDisplayHoursDecimalSpan.textContent = "∞";
          remainingElement.className =
            "job-remaining p-2 w-28 text-left text-gray-500 italic";
        }

        // Hide the edit form
        editForm.classList.add("hidden");
      } catch (error) {
        console.error("Error updating assigned value:", error);
        // You could show an error message here
      }
    });
  });

  // Cancel button click
  document.querySelectorAll(".cancel-assigned-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const editForm = button.closest(".edit-form");
      editForm.classList.add("hidden");
    });
  });

  // Click outside to close
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest(".edit-form") &&
      !e.target.closest(".edit-assigned-btn")
    ) {
      document.querySelectorAll(".edit-form").forEach((form) => {
        form.classList.add("hidden");
      });
    }
  });
}

function setupFavoriteButtons() {
  document.querySelectorAll(".favorite-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.stopPropagation();
      const jobcodeId = button.getAttribute("data-jobcode-id");
      const currentLoginDetails = await getLoginDetailsFromLocalStorage();
      const currentUserId = currentLoginDetails.currentUserId;

      chrome.storage.local.get("userProfiles", (data) => {
        const userProfiles = data.userProfiles || {};
        const userProfile = userProfiles[currentUserId] || {};
        const jobcodes = userProfile.jobcodes || {};

        if (jobcodes[jobcodeId]) {
          jobcodes[jobcodeId].is_favourite = !jobcodes[jobcodeId].is_favourite;

          chrome.storage.local.set(
            {
              userProfiles: {
                ...userProfiles,
                [currentUserId]: {
                  ...userProfiles[currentUserId],
                  jobcodes,
                },
              },
            },
            () => {
              // Re-render the table to reflect changes
              renderAllClientsTable(userProfile);
            }
          );
        }
      });
    });
  });
}

function setupFavoritesToggle() {
  const toggle = document.getElementById("favorites-toggle");
  toggle.addEventListener("change", async () => {
    const currentLoginDetails = await getLoginDetailsFromLocalStorage();
    const currentUserId = currentLoginDetails.currentUserId;

    chrome.storage.local.get("userProfiles", (data) => {
      renderAllClientsTable(data.userProfiles[currentUserId] || {});
    });
  });
}

// Add message listener for timer updates
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "onTheClock") {
    updateActiveRecordingUIWithLatestUserProfile();
    sendResponse({ success: true });
  } else if (message.action === "offTheClock") {
    updateActiveRecordingUIWithLatestUserProfile();
    sendResponse({ success: true });
  } else if (message.action === "timerUpdate") {
    // We'll handle this in the future
    sendResponse({ success: true });
  }
  return false; // Don't keep the message channel open
});

/**
 * Fetches the latest user profile from local storage and updates the UI with the active recording
 * @returns {Promise<void>}
 */
async function updateActiveRecordingUIWithLatestUserProfile() {
  const loginDetails = await getLoginDetailsFromLocalStorage();
  if (loginDetails.currentUserId) {
    const userProfile = await getUserProfileFromStorage(
      loginDetails.currentUserId
    );
    updateUIWithActiveRecording(userProfile);
  }
}

// **
// BELOW ARE THE FUNCTIONS RELATED TO COLOR THEME MANAGEMENT
// **

/**
 * Initializes the color theme and adds event listeners for the dark mode toggle
 *
 * This function sets up the dark mode toggle and applies the appropriate theme based on
 * the user's stored preference using Tailwind's built-in dark mode system.
 *
 * @async
 * @function
 * @returns {Promise<void>}
 */
async function initializeColourTheme(userProfile) {
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const userPreferences = userProfile.preferences;
  const userThemeChoice = userPreferences.theme_choice;

  // Set initial theme according to local storage
  if (userThemeChoice === "dark") {
    darkModeToggle.checked = true;
    applyTheme("dark");
  } else {
    darkModeToggle.checked = false;
    applyTheme("light");
  }

  // Add event listener for toggle
  darkModeToggle.addEventListener("change", async () => {
    const newThemeChoice = darkModeToggle.checked ? "dark" : "light";
    const updatedUserProfile = {
      ...userProfile,
      preferences: {
        ...userPreferences,
        theme_choice: newThemeChoice,
      },
    };
    overwriteUserProfileInStorage(updatedUserProfile);
    applyTheme(newThemeChoice);
  });

  // Initialize time display format toggle
  initializeTimeDisplayFormat(userProfile);
}

/**
 * Initializes the time display format toggle and applies the preference stored locally
 * @param {Object} userProfile - The user profile containing preferences
 */
async function initializeTimeDisplayFormat(userProfile) {
  const timeFormatToggle = document.getElementById("time-format-toggle");
  const userPreferences = userProfile.preferences;
  const timeDisplayFormat = userPreferences.time_display_format || "h:m:s";

  // Set initial toggle state (checked = hours_decimal, unchecked = h:m:s)
  timeFormatToggle.checked = timeDisplayFormat === "hours_decimal";

  // Apply the current format
  toggleTimeDisplayFormat(timeDisplayFormat);

  // Add event listener for toggle
  timeFormatToggle.addEventListener("change", async () => {
    const newFormat = timeFormatToggle.checked ? "hours_decimal" : "h:m:s";
    const updatedUserProfile = {
      ...userProfile,
      preferences: {
        ...userPreferences,
        time_display_format: newFormat,
      },
    };

    AppState.setUserProfile(updatedUserProfile);
    toggleTimeDisplayFormat(newFormat);
    await overwriteUserProfileInStorage(updatedUserProfile);
    // Trigger background polling to update badge display format
    try {
      await chrome.runtime.sendMessage({ action: "pollForActivity" });
    } catch (error) {
      console.error("Error sending pollForActivity message:", error);
    }
  });
}

/**
 * Applies the specified theme using Tailwind's built-in dark mode system
 *
 * This function simply toggles the 'dark' class on the document element,
 * which automatically applies all dark: variants defined in the HTML.
 *
 * @function
 * @param {string} themeName - The name of the theme to apply ('light' or 'dark')
 * @returns {void}
 */
function applyTheme(themeName) {
  const html = document.documentElement;

  if (themeName === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

/**
 * Toggles all time displays between h:m:s and hours_decimal formats
 * @param {string} newFormat - Either 'h:m:s' or 'hours_decimal'
 */
function toggleTimeDisplayFormat(newFormat) {
  // Hide all current format displays
  const currentElements = document.querySelectorAll(
    "[data-time-format-h-m-s], [data-time-format-hours-decimal]"
  );
  currentElements.forEach((element) => {
    element.classList.add("hidden");
  });

  // Show elements matching the new format
  const targetAttribute =
    newFormat === "h:m:s"
      ? "data-time-format-h-m-s"
      : "data-time-format-hours-decimal";
  const targetElements = document.querySelectorAll(`[${targetAttribute}]`);
  targetElements.forEach((element) => {
    element.classList.remove("hidden");
  });
}

// **
// BELOW ARE ALL FUNCTIONS FOR NAVIGATION AND VIEW SWITCHING
// **

function setupJobNameClickListeners() {
  document.querySelectorAll(".job-name").forEach((jobNameElement) => {
    jobNameElement.addEventListener("click", function () {
      // Get the parent row
      const jobRow = this.closest(".job-row");
      // Retrieve the jobcode id from data attribute
      const jobcodeId = jobRow.getAttribute("data-jobcode-id");
      // Switch to jobcode detail view
      showJobcodeDetailView(jobcodeId);
    });
  });
}

// Tab utility functions
function showTabs() {
  const tabNavigation = document.querySelector(
    ".flex.justify-between.border-b.mb-4"
  );
  tabNavigation.classList.remove("hidden");
}

function hideTabs() {
  const tabNavigation = document.querySelector(
    ".flex.justify-between.border-b.mb-4"
  );
  tabNavigation.classList.add("hidden");
}

function hideAllTabContent() {
  const tabContents = document.querySelectorAll(".tab-content");
  tabContents.forEach((content) => {
    content.classList.add("hidden");
  });
}

function showMyClientsView() {
  showTabs();

  // Show clients screen
  const clientsScreen = document.getElementById("clients-screen");
  clientsScreen.classList.remove("hidden");

  // Update tab button styling to show clients as active
  const tabButtons = document.querySelectorAll(".tab-button");
  tabButtons.forEach((button) => {
    if (button.getAttribute("data-tab") === "clients-screen") {
      button.classList.add("text-black", "font-bold");
    } else {
      button.classList.remove("text-black", "font-bold");
    }
  });
}

function hideMyClientsView() {
  // Hide clients screen
  const clientsScreen = document.getElementById("clients-screen");
  clientsScreen.classList.add("hidden");

  hideTabs();
}

function showClientInfoView(jobcodeId) {
  const userProfile = AppState.getUserProfile();

  // Get the client name from the jobcode
  const jobcode = userProfile.jobcodes[jobcodeId];
  const clientName = jobcode
    ? jobcode.parent_path_name + jobcode.name
    : "Unknown Client";

  const recentTimesheets = getRecentTimesheetsForJobcode(
    userProfile,
    jobcodeId
  );

  // Show jobcode detail screen
  const jobcodeDetailScreen = document.getElementById("jobcode-detail-screen");
  jobcodeDetailScreen.classList.remove("hidden");

  // Store the jobcode ID and client name for potential future use
  jobcodeDetailScreen.setAttribute("data-current-jobcode-id", jobcodeId);
  jobcodeDetailScreen.setAttribute("data-current-client-name", clientName);

  // Render the timesheets table
  renderTimesheetsTable(recentTimesheets);
  toggleTimeDisplayFormat(
    userProfile.preferences.time_display_format || "h:m:s"
  );
}

function hideClientInfoView() {
  // Hide jobcode detail screen
  const jobcodeDetailScreen = document.getElementById("jobcode-detail-screen");
  jobcodeDetailScreen.classList.add("hidden");
}

function showJobcodeDetailView(jobcodeId) {
  hideAllTabContent();
  hideMyClientsView();
  showClientInfoView(jobcodeId);
}

// **
// BELOW ARE UTILITY FUNCTIONS
// **

function getRecentTimesheetsForJobcode(userProfile, jobcodeId) {
  // Check if there are any timesheets for the given jobcode
  const jobcode = userProfile.jobcodes[jobcodeId];
  if (!jobcode.timesheets) {
    return [];
  }

  // Get all timesheet objects as an array
  const allTimesheets = Object.values(jobcode.timesheets);

  // Filter out zero duration and non-current month timesheets
  const filteredTimesheets = allTimesheets.filter(
    (timesheet) =>
      timesheet.duration > 0 && isDateInCurrentMonth(timesheet.date)
  );

  // Sort by date (newest first)
  return filteredTimesheets.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Renders the timesheets table for the jobcode detail view
 * @param {Array} timesheets - Array of timesheet objects
 * @returns {void}
 */
function renderTimesheetsTable(timesheets) {
  const container = document.getElementById("timesheets-container");
  const count = timesheets.length;

  // Get client name from data attribute
  const jobcodeDetailScreen = document.getElementById("jobcode-detail-screen");
  const clientName =
    jobcodeDetailScreen.getAttribute("data-current-client-name") ||
    "Unknown Client";

  if (count === 0) {
    container.innerHTML = `
      <div class="text-center py-8">
        <p class="text-gray-500">No completed timesheets found for ${clientName} this month</p>
      </div>
    `;
    return;
  }

  let tableHtml = `
    <div class="mb-4">
      <h3 class="text-lg font-semibold">${clientName} - completed timesheets this month (${count})</h3>
    </div>
    <div class="overflow-hidden bg-white dark:bg-gray-700 shadow-md rounded-lg">
      <!-- Table Header -->
      <div class="bg-gray-200 dark:bg-gray-600 flex w-full">
        <div class="p-3 text-left font-semibold text-gray-800 dark:text-white" style="width: 25%;">Start</div>
        <div class="p-3 text-left font-semibold text-gray-800 dark:text-white" style="width: 25%;">End</div>
        <div class="p-3 text-left font-semibold text-gray-800 dark:text-white" style="width: 15%;">Duration</div>
        <div class="p-3 text-left font-semibold text-gray-800 dark:text-white" style="width: 35%;">Notes</div>
      </div>
      
      <!-- Table Body -->
      <div class="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-700">
  `;

  timesheets.forEach((timesheet) => {
    const formattedStart = formatStartEndTime(timesheet.start);
    const formattedEnd = formatStartEndTime(timesheet.end);
    const timeDurationDisplayHms = formatSecondsToTime(timesheet.duration);
    const timeDurationDisplayHoursDecimal = formatSecondsToHoursDecimal(
      timesheet.duration
    );
    const notes = timesheet.notes || "No notes";

    // Cap notes at 25 characters and add ellipsis if needed
    const displayNotes =
      notes.length > 25 ? notes.substring(0, 25) + "..." : notes;
    const isLongNote = notes.length > 25;

    tableHtml += `
      <div class="flex w-full hover:bg-gray-50 dark:hover:bg-gray-600 group text-gray-900 dark:text-white">
        <div class="p-3 text-sm" style="width: 25%;">${formattedStart}</div>
        <div class="p-3 text-sm" style="width: 25%;">${formattedEnd}</div>
        <div class="p-3 text-sm" style="width: 15%;">
          <span data-time-format-h-m-s>${timeDurationDisplayHms}</span>
          <span data-time-format-hours-decimal class="hidden">${timeDurationDisplayHoursDecimal}</span>
        </div>
                <div class="p-3 text-sm style="width: 35%;">
          <span class="${isLongNote ? "cursor-help tooltip-trigger" : ""}" ${
      isLongNote ? `data-tooltip="${notes.replace(/"/g, "&quot;")}"` : ""
    }>${displayNotes}</span>
        </div>
      </div>
    `;
  });

  tableHtml += `
      </div>
    </div>
  `;

  container.innerHTML = tableHtml;

  // Set up tooltip functionality
  setupTooltips();
}

/**
 * Sets up global tooltip functionality using fixed positioning
 */
function setupTooltips() {
  // Remove any existing tooltip
  const existingTooltip = document.getElementById("global-tooltip");
  if (existingTooltip) {
    existingTooltip.remove();
  }

  // Create global tooltip element
  const tooltip = document.createElement("div");
  tooltip.id = "global-tooltip";
  tooltip.className =
    "fixed z-50 hidden bg-black text-white text-xs px-3 py-2 rounded shadow-lg max-w-xs whitespace-normal pointer-events-none";
  document.body.appendChild(tooltip);

  // Add event listeners to all tooltip triggers
  document.querySelectorAll(".tooltip-trigger").forEach((trigger) => {
    trigger.addEventListener("mouseenter", (e) => {
      const tooltipText = e.target.getAttribute("data-tooltip");
      if (tooltipText) {
        tooltip.textContent = tooltipText;
        tooltip.classList.remove("hidden");

        // Position tooltip above the element
        const rect = e.target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        // Position above the element, centered horizontally
        let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        let top = rect.top - tooltipRect.height - 8; // 8px gap

        // Ensure tooltip doesn't go off screen horizontally
        if (left < 8) left = 8;
        if (left + tooltipRect.width > window.innerWidth - 8) {
          left = window.innerWidth - tooltipRect.width - 8;
        }

        // If tooltip would go above viewport, show it below instead
        if (top < 8) {
          top = rect.bottom + 8;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      }
    });

    trigger.addEventListener("mouseleave", () => {
      tooltip.classList.add("hidden");
    });
  });
}

/**
 * Calculates the total duration of timesheets completed in the current month for a given jobcode
 *
 * @param {Object} jobcode - The jobcode object containing timesheet information
 * @param {Object} jobcode.timesheets - Object containing timesheet entries
 * @param {Object} jobcode.timesheets[].date - String date in format "YYYY-MM-DD"
 * @param {number} jobcode.timesheets[].duration - Duration in seconds
 * @returns {number} Total duration in seconds of timesheets from the current month
 */
function calculateSecondsCompletedThisMonth(jobcode) {
  const timesheets = jobcode.timesheets || {};
  const allTimesheets = Object.values(timesheets);

  return allTimesheets.reduce((acc, timesheet) => {
    if (isDateInCurrentMonth(timesheet.date)) {
      return acc + timesheet.duration;
    }
    return acc;
  }, 0);
}
