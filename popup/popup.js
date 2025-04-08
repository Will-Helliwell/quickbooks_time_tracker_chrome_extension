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
  console.log("typeof jobcodes:", typeof jobcodes);
  let allClientsTableHtml = "";
  allClientsTableHtml += `<table class="w-full bg-white shadow-md rounded-lg">
    <thead>
      <tr class="bg-gray-200">
        <th class="p-2 text-left">Name</th>
        <th class="p-2 text-left">Completed (s)</th>
        <th class="p-2 text-left">Assigned (s)</th>
        <th class="p-2 text-left">Current Session (s)</th>
      </tr>
    </thead>
    <tbody id="all-clients-table-body" class="divide-y">`;

  jobcodes.forEach((jobcode) => {
    console.log("jobcode:", jobcode);
    const jobcodeName = jobcode.name;
    console.log("jobcodeName:", jobcodeName);

    allClientsTableHtml += `
      <tr>
        <td class="p-2">${jobcode.name}</td>
        <td class="p-2">${jobcode.seconds_completed}</td>
        <td class="p-2">${jobcode.seconds_assigned}</td>
        <td class="p-2">-</td>
      </tr>`;
  });

  allClientsTableHtml += `</tbody>
  </table>`;

  const allClientsTable = document.getElementById("all-clients-table");
  allClientsTable.innerHTML = allClientsTableHtml;
}

async function handleJobcodesButton() {
  const jobcodes = await updateJobcodesAndTimesheetsFromAPI();
}
