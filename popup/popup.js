document.addEventListener("DOMContentLoaded", async () => {
    const loginScreen = document.getElementById("login-screen");
    const mainContent = document.getElementById("main-content");
    const loginButton = document.getElementById("login-button");
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
        const isAuthenticated = await authenticateUser(); // Wait for OAuth result

        if (isAuthenticated) {
            loginScreen.classList.add("hidden");
            mainContent.classList.remove("hidden");

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

    // Load clients data
    async function loadClients() {
        const clientsTable = document.querySelector("#clients-screen tbody");
        clientsTable.innerHTML = ""; // Clear table
        const clients = await fetchClientsFromQuickBooks(); // Fetch data from API

        clients.forEach(client => {
            const row = document.createElement("tr");
            row.innerHTML = `<td class="p-2">${client.name}</td><td class="p-2">${client.hoursWorked}</td>`;
            clientsTable.appendChild(row);
        });
    }

    // Load settings
    async function loadSettings() {
        const result = await chrome.storage.local.get("colorTheme");
        document.getElementById("color-theme").value = result.colorTheme || "#000000";
    }

    // Save settings
    document.getElementById("save-settings").addEventListener("click", async () => {
        const color = document.getElementById("color-theme").value;
        await chrome.storage.local.set({ colorTheme: color });
        alert("Settings saved!");
    });
});
