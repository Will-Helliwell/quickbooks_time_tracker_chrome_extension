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
            // loadClients();
            // loadSettings();
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

    async function loadUser() {
        const userInitialsContainer = document.getElementById("user-initials");
        const userFullNameContainer = document.getElementById("user-full-name");
        const userCompanyContainer = document.getElementById("user-company");
        const user = await fetchCurrentUserFromQuickBooks();
        const userFirstName = user.first_name;
        const userLastName = user.last_name;
        const userCompany = user.company_name;
        const userFullName = `${userFirstName} ${userLastName}`;
        const userInitials = `${userFirstName[0]}${userLastName[0]}`;
        userFullNameContainer.textContent = userFullName;
        userCompanyContainer.textContent = userCompany;
        userInitialsContainer.textContent = userInitials;
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

    // Save settings
    document.getElementById("save-settings").addEventListener("click", async () => {
        const color = document.getElementById("color-theme").value;
        await chrome.storage.local.set({ colorTheme: color });
        alert("Settings saved!");
    });
});
