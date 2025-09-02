/**
 * Audio Upload Module - Handles file selection and upload functionality
 * 
 * This module provides the UI logic for selecting and uploading MP3 files
 * using the File System Access API and storing them via the audioStorage utility.
 */

import { 
  storeAudioFile, 
  getAllAudioFiles, 
  deleteAudioFile, 
  audioFileExists,
  getStorageStats 
} from '/shared/audioStorage.js';

// Global state for selected file
let selectedFile = null;

/**
 * Initialize the audio upload functionality
 * Called when the popup loads
 */
export function initializeAudioUpload() {
  setupEventListeners();
  loadUploadedFilesList();
  updateStorageStats();
}

/**
 * Set up event listeners for upload functionality
 */
function setupEventListeners() {
  const selectButton = document.getElementById('select-audio-file');
  const uploadButton = document.getElementById('upload-audio-file');
  
  if (selectButton) {
    selectButton.addEventListener('click', handleFileSelection);
  }
  
  if (uploadButton) {
    uploadButton.addEventListener('click', handleFileUpload);
  }
}

/**
 * Handle file selection using File System Access API
 */
async function handleFileSelection() {
  try {
    // Check if File System Access API is supported
    if (!window.showOpenFilePicker) {
      showStatus('File System Access API not supported in this browser', 'error');
      return;
    }

    // Configure file picker options
    const options = {
      types: [{
        description: 'MP3 Audio Files',
        accept: {
          'audio/mpeg': ['.mp3']
        }
      }],
      multiple: false,
      excludeAcceptAllOption: true
    };

    // Show file picker
    const [fileHandle] = await window.showOpenFilePicker(options);
    const file = await fileHandle.getFile();
    
    // Validate file
    if (!file.type.startsWith('audio/')) {
      showStatus('Please select a valid audio file', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      showStatus('File too large. Please select a file smaller than 10MB', 'error');
      return;
    }

    // Extract name without extension
    const fileName = file.name.replace(/\.[^/.]+$/, '');
    
    // Check if file with this name already exists
    if (await audioFileExists(fileName)) {
      showStatus(`A file named "${fileName}" already exists`, 'error');
      return;
    }

    // Store selected file
    selectedFile = {
      file: file,
      name: fileName,
      size: file.size,
      type: file.type
    };

    // Update UI
    updateSelectedFileInfo();
    enableUploadButton();
    showStatus('File selected successfully', 'success');

  } catch (error) {
    if (error.name === 'AbortError') {
      showStatus('File selection cancelled', 'info');
    } else {
      console.error('File selection error:', error);
      showStatus('Error selecting file', 'error');
    }
  }
}

/**
 * Handle file upload to IndexedDB
 */
async function handleFileUpload() {
  if (!selectedFile) {
    showStatus('No file selected', 'error');
    return;
  }

  try {
    disableUploadButton();
    showStatus('Uploading file...', 'loading');

    // Convert file to ArrayBuffer
    const arrayBuffer = await selectedFile.file.arrayBuffer();
    
    // Store in IndexedDB
    await storeAudioFile(
      selectedFile.name,
      arrayBuffer,
      selectedFile.type
    );

    showStatus(`File "${selectedFile.name}" uploaded successfully`, 'success');
    
    // Reset state
    selectedFile = null;
    clearSelectedFileInfo();
    disableUploadButton();
    
    // Refresh UI
    loadUploadedFilesList();
    updateStorageStats();

  } catch (error) {
    console.error('Upload error:', error);
    showStatus('Error uploading file', 'error');
    enableUploadButton();
  }
}

/**
 * Load and display the list of uploaded files
 */
async function loadUploadedFilesList() {
  const listContainer = document.getElementById('uploaded-files-list');
  if (!listContainer) return;

  try {
    const audioFiles = await getAllAudioFiles();
    
    if (audioFiles.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
          No custom sounds uploaded yet
        </div>
      `;
      return;
    }

    // Sort by upload date (newest first)
    audioFiles.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    const filesHtml = audioFiles.map(file => `
      <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-600 rounded border">
        <div class="flex-1">
          <div class="text-sm font-medium text-gray-900 dark:text-white">${file.name}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            ${formatFileSize(file.size)} • Uploaded ${formatDate(file.uploadDate)}
          </div>
        </div>
        <button 
          class="delete-audio-btn text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1" 
          data-file-id="${file.id}"
          title="Delete file">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `).join('');

    listContainer.innerHTML = filesHtml;

    // Add delete event listeners
    const deleteButtons = listContainer.querySelectorAll('.delete-audio-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', () => handleFileDelete(button.dataset.fileId));
    });

  } catch (error) {
    console.error('Error loading uploaded files:', error);
    listContainer.innerHTML = `
      <div class="text-center py-4 text-red-500 text-sm">
        Error loading uploaded files
      </div>
    `;
  }
}

/**
 * Handle file deletion
 */
async function handleFileDelete(fileId) {
  if (!confirm('Are you sure you want to delete this audio file?')) {
    return;
  }

  try {
    await deleteAudioFile(fileId);
    showStatus('File deleted successfully', 'success');
    loadUploadedFilesList();
    updateStorageStats();
  } catch (error) {
    console.error('Delete error:', error);
    showStatus('Error deleting file', 'error');
  }
}

/**
 * Update storage statistics display
 */
async function updateStorageStats() {
  const statsContainer = document.getElementById('storage-stats');
  if (!statsContainer) return;

  try {
    const stats = await getStorageStats();
    statsContainer.textContent = `${stats.fileCount} files • ${stats.totalSizeMB}MB used`;
  } catch (error) {
    console.error('Error getting storage stats:', error);
    statsContainer.textContent = 'Storage stats unavailable';
  }
}

/**
 * Update selected file information display
 */
function updateSelectedFileInfo() {
  const infoContainer = document.getElementById('selected-file-info');
  if (!infoContainer || !selectedFile) return;

  infoContainer.innerHTML = `
    <div class="flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
      <span><strong>${selectedFile.name}</strong> • ${formatFileSize(selectedFile.size)}</span>
    </div>
  `;
  infoContainer.classList.remove('hidden');
}

/**
 * Clear selected file information
 */
function clearSelectedFileInfo() {
  const infoContainer = document.getElementById('selected-file-info');
  if (infoContainer) {
    infoContainer.classList.add('hidden');
    infoContainer.innerHTML = '';
  }
}

/**
 * Enable upload button
 */
function enableUploadButton() {
  const uploadButton = document.getElementById('upload-audio-file');
  if (uploadButton) {
    uploadButton.disabled = false;
  }
}

/**
 * Disable upload button
 */
function disableUploadButton() {
  const uploadButton = document.getElementById('upload-audio-file');
  if (uploadButton) {
    uploadButton.disabled = true;
  }
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  const statusContainer = document.getElementById('upload-status');
  if (!statusContainer) return;

  const colors = {
    success: 'text-green-600',
    error: 'text-red-600',
    info: 'text-blue-600',
    loading: 'text-gray-600'
  };

  statusContainer.textContent = message;
  statusContainer.className = `text-xs ${colors[type] || colors.info}`;
  statusContainer.classList.remove('hidden');

  // Auto-hide after 3 seconds for non-loading messages
  if (type !== 'loading') {
    setTimeout(() => {
      statusContainer.classList.add('hidden');
    }, 3000);
  }
}

/**
 * Utility function to format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Utility function to format date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}