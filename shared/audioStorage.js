/**
 * Audio Storage Utility - User-scoped IndexedDB storage for custom audio files
 * 
 * This module provides a single source of truth for user-uploaded audio files
 * using IndexedDB with proper user scoping. Each audio record includes the userId
 * to ensure complete data separation between users.
 * 
 * Design principles:
 * - Single source of truth (no sync issues)
 * - User-scoped data (userId field in all records)
 * - Data persistence across login/logout cycles
 * - Atomic operations for consistency
 */

const DB_NAME = 'AudioStorage';
const DB_VERSION = 1;
const STORE_NAME = 'userAudio';

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
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        // Index by userId for efficient user-scoped queries
        store.createIndex('userId', 'userId', { unique: false });
        // Index by userId + name combination for duplicate checking
        store.createIndex('userIdName', ['userId', 'name'], { unique: true });
        store.createIndex('uploadDate', 'uploadDate', { unique: false });
      }
    };
  });
}

/**
 * Get current user ID from Chrome storage
 * @returns {Promise<string|null>} Current user ID or null if not logged in
 */
async function getCurrentUserId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['loginDetails'], (data) => {
      resolve(data.loginDetails?.currentUserId || null);
    });
  });
}

/**
 * Store an audio file for the current user in IndexedDB
 * @param {string} name - The name of the audio file (without extension)
 * @param {ArrayBuffer} audioData - The audio file data
 * @param {string} mimeType - The MIME type of the audio file
 * @returns {Promise<string>} The ID of the stored audio file
 */
export async function storeAudioFile(name, audioData, mimeType = 'audio/mpeg') {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('No user logged in - cannot store audio file');
  }

  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const audioRecord = {
      id: `${userId}_${name}_${Date.now()}`, // User-scoped unique ID
      userId: userId,
      name: name,
      data: audioData,
      mimeType: mimeType,
      uploadDate: new Date().toISOString(),
      size: audioData.byteLength
    };
    
    const request = store.add(audioRecord);
    
    request.onsuccess = () => {
      console.log(`Audio file '${name}' stored successfully for user ${userId} with ID: ${audioRecord.id}`);
      resolve(audioRecord.id);
    };
    
    request.onerror = () => {
      console.error(`Failed to store audio file '${name}' for user ${userId}:`, request.error);
      reject(request.error);
    };
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Retrieve an audio file from IndexedDB by ID
 * @param {string} id - The ID of the audio file
 * @returns {Promise<Object|null>} The audio record or null if not found
 */
export async function getAudioFile(id) {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get all audio files for the current user
 * @returns {Promise<Array>} Array of audio records for current user
 */
export async function getAllAudioFiles() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return []; // Return empty array if no user logged in
  }

  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('userId');
    const request = index.getAll(userId);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Delete an audio file from IndexedDB
 * Verifies the file belongs to the current user before deletion
 * @param {string} id - The ID of the audio file to delete
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteAudioFile(id) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('No user logged in - cannot delete audio file');
  }

  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // First verify the file belongs to current user
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) {
        reject(new Error('Audio file not found'));
        return;
      }
      
      if (record.userId !== userId) {
        reject(new Error('Cannot delete audio file - access denied'));
        return;
      }
      
      // File belongs to user, proceed with deletion
      const deleteRequest = store.delete(id);
      
      deleteRequest.onsuccess = () => {
        console.log(`Audio file '${record.name}' deleted successfully for user ${userId}`);
        resolve(true);
      };
      
      deleteRequest.onerror = () => {
        console.error(`Failed to delete audio file with ID '${id}':`, deleteRequest.error);
        reject(deleteRequest.error);
      };
    };
    
    getRequest.onerror = () => reject(getRequest.error);
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Check if an audio file with the given name already exists for current user
 * @param {string} name - The name to check
 * @returns {Promise<boolean>} True if a file with this name exists for current user
 */
export async function audioFileExists(name) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return false; // No user logged in, so no files exist for "current user"
  }

  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('userIdName');
    const request = index.get([userId, name]);
    
    request.onsuccess = () => resolve(request.result !== undefined);
    request.onerror = () => reject(request.error);
    
    transaction.oncomplete = () => db.close();
  });
}

/**
 * Get storage statistics for current user
 * @returns {Promise<Object>} Object with count and total size information for current user
 */
export async function getStorageStats() {
  const files = await getAllAudioFiles();
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  return {
    fileCount: files.length,
    totalSize: totalSize,
    totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
  };
}