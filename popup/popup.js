document.addEventListener("DOMContentLoaded", async () => {
    const loginScreen = document.getElementById("login-screen");
    const loginButton = document.getElementById("login-button");
    const clientSecretInput = document.getElementById("client-secret");
    const loadingSpinner = document.getElementById("loading-spinner");
    const mainContent = document.getElementById("main-content");
    const tabButtons = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(".tab-content");

    // Check if user is already authenticated
    chrome.storage.local.get("authToken", (result) => {
        if (result.authToken) {
            loginScreen.classList.add("hidden");
            mainContent.classList.remove("hidden");
            loadUser();
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
            loadUser();
        }
    });

    // Handle tab switching
    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            tabButtons.forEach(btn => btn.classList.remove("text-black", "font-bold"));
            button.classList.add("text-black", "font-bold");

            const targetTab = button.getAttribute("data-tab");
            tabContents.forEach(content => {
                content.classList.toggle("hidden", content.id !== targetTab);
            });
        });
    });

    // Save settings
    document.getElementById("save-settings").addEventListener("click", async () => {
        const color = document.getElementById("color-theme").value;
        await chrome.storage.local.set({ colorTheme: color });
        alert("Settings saved!");
    });
});

/**
 * Loads the user profile by first checking local storage and updating the UI immediately if found.
 * If no stored profile is available, it fetches the latest user data from QuickBooks Time,
 * updates the UI, and stores the data for future use.
 * 
 * @async
 * @returns {Promise<void>} Resolves when the user data is retrieved and UI is updated.
 */
async function loadUser() {
    
    // Try to get user data from local storage first and UI immediately if so
    const storedUserProfile = await getUserProfileFromStorage();

    if (storedUserProfile) {
        updateUserUI(storedUserProfile);
    } else {
        // If no stored data, fetch from QuickBooks Time, save in storage and update UI
        const updatedUserProfile = await fetchCurrentUserFromQuickBooks();
        updateUserUI(updatedUserProfile);
        saveUserProfileToStorage(updatedUserProfile);
    }
}

/**
 * Retrieves the user profile from Chrome storage.
 * @returns {Promise<object|null>} The user profile object or null if not found.
 */
function getUserProfileFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get("userProfile", (data) => {
            resolve(data.userProfile || null);
        });
    });
}

/**
 * Saves the user profile to Chrome storage.
 * @param {object} user The user profile object to save.
 */
function saveUserProfileToStorage(user) {
    chrome.storage.local.set({ userProfile: user });
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


async function fetchCurrentUserFromQuickBooks() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action: "fetchCurrentUser" },
            (response) => {                    
                if (response && response.success) {
                    resolve(response.user);
                } else {
                    resolve(false);
                }
            }
        );
    });
}
