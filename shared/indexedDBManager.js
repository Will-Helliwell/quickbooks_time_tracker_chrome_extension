/**
 * IndexedDB Manager - Singleton database connection manager
 *
 * This module provides a single database connection per context (background, popup, content)
 * to avoid the overhead of opening/closing connections for each operation.
 *
 * Usage:
 * - Call getDB() to get the shared database connection
 * - The connection is automatically initialized on first use
 * - Each context (background, popup, content) gets its own singleton instance
 */

/**
 * Get database constants for use in other modules
 */
const DB_NAME = "QuickBooksTimeTrackerDB";
const DB_VERSION = 1;
export const DB_CONSTANTS = {
  DB_NAME,
  DB_VERSION,
};

// Object store names
export const STORES = {
  USER_AUDIO: "userAudio",
};

// Singleton database connection per context
let dbConnection = null;

/**
 * Get the shared database connection
 * Creates connection on first call, reuses it on subsequent calls
 * @returns {Promise<IDBDatabase>} The shared database connection
 */
export async function getDB() {
  if (!dbConnection) {
    dbConnection = await initDB();

    // Handle connection close/error events
    dbConnection.onclose = () => {
      dbConnection = null;
    };

    dbConnection.onerror = (event) => {
      console.error("IndexedDB connection error:", event);
      dbConnection = null;
    };
  }

  return dbConnection;
}

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>} The database instance
 */
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create userAudio object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORES.USER_AUDIO)) {
        const store = db.createObjectStore(STORES.USER_AUDIO, {
          keyPath: "id",
        });
        // Index by userId for efficient user-scoped queries
        store.createIndex("userId", "userId", { unique: false });
        // Index by userId + name combination for duplicate checking
        store.createIndex("userIdName", ["userId", "name"], { unique: true });
        store.createIndex("uploadDate", "uploadDate", { unique: false });
      }

      // Future stores can be added here as needed
      // Example:
      // if (!db.objectStoreNames.contains(STORES.USER_SETTINGS)) {
      //   const settingsStore = db.createObjectStore(STORES.USER_SETTINGS, { keyPath: "id" });
      //   settingsStore.createIndex("userId", "userId", { unique: false });
      // }
    };
  });
}
