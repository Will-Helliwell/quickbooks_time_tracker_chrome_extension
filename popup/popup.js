import { authenticateUser } from "/popup/auth.js";
import { getLoginDetailsFromLocalStorage } from "/popup/loginDetails.js";
import {
  updateUserProfileFromAPI,
  getUserProfileFromStorage,
} from "/popup/user.js";
import {
  updateJobcodesAndTimesheetsFromAPI,
  updateSecondsAssigned,
} from "/popup/jobcodes.js";
import { logout } from "/popup/auth.js";

document.addEventListener("DOMContentLoaded", () => {
  handlePopupOpen();
});

async function handlePopupOpen() {
  const loginScreen = document.getElementById("login-screen");
  const loginButton = document.getElementById("login-button");
  const clientSecretInput = document.getElementById("client-secret");
  const loadingSpinner = document.getElementById("loading-spinner");
  const mainContent = document.getElementById("main-content");
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  // If the user is already logged in, load their profile
  const loginDetails = await getLoginDetailsFromLocalStorage();
  if (
    loginDetails.authToken &&
    loginDetails.currentUserId &&
    loginDetails.authTokenExpiryTimestamp &&
    new Date(loginDetails.authTokenExpiryTimestamp) > new Date()
  ) {
    loginScreen.classList.add("hidden");
    mainContent.classList.remove("hidden");

    loadUserFromLocalStorage(loginDetails.currentUserId);
  }

  // Handle login
  loginButton.addEventListener("click", async () => {
    loginButton.classList.add("hidden");
    clientSecretInput.classList.add("hidden");
    loadingSpinner.classList.remove("hidden");
    const isAuthenticated = await authenticateUser();
    loginButton.classList.remove("hidden");
    clientSecretInput.classList.remove("hidden");
    loadingSpinner.classList.add("hidden");
    if (isAuthenticated) {
      loginScreen.classList.add("hidden");
      mainContent.classList.remove("hidden");
      loadUserFromAPI();
      // TODO - re-render frontend
    }
  });

  // Handle get jobcodes
  document
    .getElementById("get-jobcodes")
    .addEventListener("click", async () => {
      handleJobcodesButton();
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

  // Save settings
  document
    .getElementById("save-settings")
    .addEventListener("click", async () => {
      const color = document.getElementById("color-theme").value;
      await chrome.storage.local.set({ colorTheme: color });
      alert("Settings saved!");
    });
}

async function loadUserFromAPI() {
  const userProfile = await updateUserProfileFromAPI();
  updateUserUI(userProfile);
}

async function loadUserFromLocalStorage(userProfileId) {
  let userProfile = await getUserProfileFromStorage(userProfileId);
  if (userProfile === null) {
    userProfile = await updateUserProfileFromAPI();
  }
  updateUserUI(userProfile);
  const allJobcodesArray = Object.values(userProfile.jobcodes);
  renderAllClientsTable(allJobcodesArray);
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

function renderAllClientsTable(jobcodes) {
  // filter out any jobcodes with children as these cannot have timesheets assigned
  jobcodes = jobcodes.filter((jobcode) => !jobcode.has_children);

  let allClientsTableHtml = `
    <div class="table-container overflow-hidden flex flex-col bg-white shadow-md rounded-lg">
      <!-- Fixed header -->
      <div class="bg-gray-200 flex w-full">
        <div class="p-2 text-left font-semibold flex-1 table-column-name">Name</div>
        <div class="p-2 text-left font-semibold w-28 table-column-completed">Completed</div>
        <div class="p-2 text-left font-semibold w-28 table-column-assigned">Assigned</div>
        <div class="p-2 text-left font-semibold w-28 table-column-remaining">Remaining</div>
      </div>
      
      <!-- Scrollable body -->
      <div class="overflow-y-auto max-h-64">`;

  jobcodes.forEach((jobcode) => {
    // Format time displays
    const completedFormatted = formatSecondsToTime(jobcode.seconds_completed);

    // Display friendly text for null values
    const assignedValue =
      jobcode.seconds_assigned !== null
        ? formatSecondsToTime(jobcode.seconds_assigned)
        : "No limit";
    const valueClass =
      jobcode.seconds_assigned !== null ? "" : "text-gray-500 italic";

    // Calculate remaining time (only if there's an assigned limit)
    let remainingFormatted, remainingClass;
    if (jobcode.seconds_assigned !== null) {
      const remainingSeconds = Math.max(
        0,
        jobcode.seconds_assigned - jobcode.seconds_completed
      );
      remainingFormatted = formatSecondsToTime(remainingSeconds);

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
      remainingFormatted = "∞"; // Infinity symbol for unlimited
      remainingClass = "text-gray-500 italic";
    }

    allClientsTableHtml += `
      <div class="job-row flex w-full border-t border-gray-200 hover:bg-gray-50" data-jobcode-id="${
        jobcode.id
      }">
        <div class="job-name p-2 flex-1 truncate">${
          jobcode.parent_path_name + jobcode.name
        }</div>
        <div class="job-completed p-2 w-28 text-right" data-completed="${
          jobcode.seconds_completed
        }">${completedFormatted}</div>
        <div class="job-assigned-container p-2 w-28 text-right relative group">
          <span class="job-assigned-value cursor-pointer group-hover:text-blue-600 ${valueClass}" 
                data-value="${
                  jobcode.seconds_assigned !== null
                    ? jobcode.seconds_assigned
                    : ""
                }">
            ${assignedValue}
          </span>
          <button class="edit-assigned-btn opacity-0 group-hover:opacity-100 absolute right-1 ml-1 text-blue-600 focus:outline-none" data-jobcode-id="${
            jobcode.id
          }">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <div class="edit-form hidden absolute right-0 mt-1 bg-white p-2 shadow-lg rounded-md z-10 border border-gray-200" style="min-width: 220px;">
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
              <div class="flex space-x-2 mb-2">
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
              <button class="cancel-assigned-btn px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded">Cancel</button>
            </div>
          </div>
        </div>
        <div class="job-remaining p-2 w-28 text-right ${remainingClass}">${remainingFormatted}</div>
      </div>`;
  });

  allClientsTableHtml += `
      </div>
    </div>`;

  const allClientsTable = document.getElementById("all-clients-table");
  allClientsTable.innerHTML = allClientsTableHtml;

  // Add event listeners for editing assigned values
  setupAssignedValueEditing();
}

function setupAssignedValueEditing() {
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
        const input = e.target
          .closest(".edit-form")
          .querySelector(".hours-input");
        input.focus();
        input.select();
      }
    });
  });

  // Update hidden input when time inputs change
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

        // Calculate total seconds
        const hours = parseInt(hoursInput.value) || 0;
        const minutes = parseInt(minutesInput.value) || 0;
        const seconds = parseInt(secondsInput.value) || 0;

        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
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
        // Call function to update the value
        // await updateAssignedValue(jobcodeId, newValue);
        await updateSecondsAssigned(jobcodeId, newValue);

        // Find the job row container using the jobcode ID
        const jobRow = document.querySelector(
          `.job-row[data-jobcode-id="${jobcodeId}"]`
        );

        // Update the assigned value display
        const assignedSpan = jobRow.querySelector(".job-assigned-value");
        if (newValue !== null) {
          assignedSpan.textContent = formatSecondsToTime(newValue);
          assignedSpan.classList.remove("text-gray-500", "italic");
          assignedSpan.setAttribute("data-value", newValue);
        } else {
          assignedSpan.textContent = "No limit";
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
          remainingElement.textContent = formatSecondsToTime(remainingSeconds);

          // Update styling based on remaining time
          remainingElement.className = "job-remaining p-2 w-28 text-right";
          if (remainingSeconds === 0) {
            remainingElement.classList.add("text-red-600", "font-bold");
          } else if (remainingSeconds < newValue * 0.1) {
            remainingElement.classList.add("text-red-600");
          } else if (remainingSeconds < newValue * 0.25) {
            remainingElement.classList.add("text-orange-500");
          } else {
            remainingElement.classList.add("text-green-600");
          }
        } else {
          remainingElement.textContent = "∞";
          remainingElement.className =
            "job-remaining p-2 w-28 text-right text-gray-500 italic";
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

// Function to format seconds into HH:MM:SS format
function formatSecondsToTime(seconds) {
  if (seconds === 0) return "0h 0m";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  let result = "";
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0) result += `${minutes}m`;
  if (remainingSeconds > 0 && hours === 0) result += ` ${remainingSeconds}s`;

  return result.trim();
}

async function handleJobcodesButton() {
  const jobcodes = await updateJobcodesAndTimesheetsFromAPI();
}
