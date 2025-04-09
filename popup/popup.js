import { authenticateUser } from "/popup/auth.js";
import {
  updateUserProfileFromAPI,
  getUserProfileFromStorage,
} from "/popup/user.js";
import { updateJobcodesAndTimesheetsFromAPI } from "/popup/jobcodes.js";
import { logout } from "/popup/auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const loginScreen = document.getElementById("login-screen");
  const loginButton = document.getElementById("login-button");
  const clientSecretInput = document.getElementById("client-secret");
  const loadingSpinner = document.getElementById("loading-spinner");
  const mainContent = document.getElementById("main-content");
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  // Check if user is already authenticated
  chrome.storage.local.get("loginDetails", (result) => {
    const loginDetails = result.loginDetails;
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
  });

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
});

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
  console.log("allJobcodesArray:", allJobcodesArray);
  console.log("typeof allJobcodesArray:", typeof allJobcodesArray);
  console.log(Array.isArray(allJobcodesArray)); // Should be true
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
  console.log("jobcodes:", jobcodes);

  // Create a container div with fixed height and table structure
  let allClientsTableHtml = `
    <div class="table-container overflow-hidden flex flex-col bg-white shadow-md rounded-lg">
      <!-- Fixed header -->
      <div class="bg-gray-200 flex w-full">
        <div class="p-2 text-left font-semibold flex-1">Name</div>
        <div class="p-2 text-left font-semibold w-28">Completed (s)</div>
        <div class="p-2 text-left font-semibold w-28">Assigned (s)</div>
        <div class="p-2 text-left font-semibold w-36">Current Session (s)</div>
      </div>
      
      <!-- Scrollable body -->
      <div class="overflow-y-auto max-h-64">`;

  jobcodes.forEach((jobcode) => {
    // Display friendly text for null values
    const assignedValue =
      jobcode.seconds_assigned !== null ? jobcode.seconds_assigned : "No limit";
    const valueClass =
      jobcode.seconds_assigned !== null ? "" : "text-gray-500 italic";

    allClientsTableHtml += `
      <div class="flex w-full border-t border-gray-200 hover:bg-gray-50">
        <div class="p-2 flex-1 truncate">${jobcode.name}</div>
        <div class="p-2 w-28 text-right">${jobcode.seconds_completed}</div>
        <div class="p-2 w-28 text-right relative group">
          <span class="assigned-value cursor-pointer group-hover:text-blue-600 ${valueClass}" 
                data-value="${
                  jobcode.seconds_assigned !== null
                    ? jobcode.seconds_assigned
                    : ""
                }">${assignedValue}</span>
          <button class="edit-assigned-btn opacity-0 group-hover:opacity-100 absolute right-1 ml-1 text-blue-600 focus:outline-none" data-jobcode-id="${
            jobcode.id
          }">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <div class="edit-form hidden absolute right-0 mt-1 bg-white p-2 shadow-lg rounded-md z-10 border border-gray-200" style="min-width: 180px;">
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
              <input type="number" min="0" class="assigned-input w-full p-1 border rounded mb-2" 
                     value="${
                       jobcode.seconds_assigned !== null
                         ? jobcode.seconds_assigned
                         : ""
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
        <div class="p-2 w-36 text-right">-</div>
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
          form !== e.target.nextElementSibling &&
          !form.classList.contains("hidden")
        ) {
          form.classList.add("hidden");
        }
      });

      // Show this edit form
      const editForm = button.nextElementSibling;
      editForm.classList.toggle("hidden");

      // Focus on checkbox or input based on current state
      if (editForm.querySelector(".limit-checkbox").checked) {
        const input = editForm.querySelector(".assigned-input");
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
          .querySelector(".assigned-input");
        input.focus();
        input.select();
      }
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
        await updateAssignedValue(jobcodeId, newValue);

        // Update the display value
        const displaySpan = editForm
          .closest(".relative")
          .querySelector(".assigned-value");
        if (newValue !== null) {
          displaySpan.textContent = newValue;
          displaySpan.classList.remove("text-gray-500", "italic");
          displaySpan.setAttribute("data-value", newValue);
        } else {
          displaySpan.textContent = "No limit";
          displaySpan.classList.add("text-gray-500", "italic");
          displaySpan.setAttribute("data-value", "");
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

// Function to update the assigned value in the backend
async function updateAssignedValue(jobcodeId, newValue) {
  // Implementation for API call to update the assigned value
  console.log(
    `Updating jobcode ${jobcodeId} with value: ${
      newValue === null ? "null (no limit)" : newValue
    }`
  );

  // For now, just return a promise that resolves immediately
  return Promise.resolve({ success: true });
}

async function handleJobcodesButton() {
  const jobcodes = await updateJobcodesAndTimesheetsFromAPI();
}
