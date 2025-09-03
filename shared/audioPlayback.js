/**
 * Audio Playback Utility - Unified interface for playing both pre-packaged and custom sounds
 *
 * This module provides a clean interface for playing audio files from two sources:
 * - Pre-packaged sounds (from /sounds directory)
 * - Custom user-uploaded sounds (from IndexedDB)
 *
 * The module abstracts the complexity of different sound sources and provides
 * a consistent API that works across popup, background, and offscreen contexts.
 */

import { getAudioFile } from "./audioStorage.js";

/**
 * Play a sound by name or ID
 * Automatically detects if it's a pre-packaged sound or custom sound
 * and routes to appropriate playback method
 *
 * @param {string} soundIdentifier - Either a pre-packaged sound name or custom sound ID
 * @returns {Promise<void>} Resolves when playback starts
 */
export async function playSound(soundIdentifier) {
  try {
    // Check if it's a custom sound (contains underscore pattern indicating user ID)
    if (isCustomSoundId(soundIdentifier)) {
      await playCustomSound(soundIdentifier);
    } else {
      await playPrePackagedSound(soundIdentifier);
    }
  } catch (error) {
    console.error("Failed to play sound:", error);
    throw error;
  }
}

/**
 * Play a pre-packaged sound from the /sounds directory
 * @param {string} soundName - The name of the sound file (without .mp3 extension)
 * @returns {Promise<void>}
 */
export async function playPrePackagedSound(soundName) {
  return new Promise((resolve, reject) => {
    // Send message to background script, which will handle offscreen document
    chrome.runtime.sendMessage(
      {
        action: "playPrePackagedSound",
        soundName: soundName,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      }
    );
  });
}

/**
 * Play a custom uploaded sound from IndexedDB
 * @param {string} soundId - The ID of the custom sound
 * @returns {Promise<void>}
 */
export async function playCustomSound(soundId) {
  console.log("in playCustomSound with id:", soundId);
  try {
    // Retrieve the audio file from IndexedDB
    const audioRecord = await getAudioFile(soundId);

    console.log("Retrieved audio record:", audioRecord);

    if (!audioRecord) {
      throw new Error(`Custom sound with ID '${soundId}' not found`);
    }

    console.log("about to send message to background script...");

    // Convert ArrayBuffer to Uint8Array for message passing
    const audioArray = new Uint8Array(audioRecord.data);

    // Send audio data to background script, which will handle offscreen document
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "playCustomSound",
          soundId: soundId,
          audioData: Array.from(audioArray), // Convert to regular array for JSON serialization
          mimeType: audioRecord.mimeType,
          soundName: audioRecord.name,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });
  } catch (error) {
    console.error(`Failed to play custom sound '${soundId}':`, error);
    throw error;
  }
}

/**
 * Determine if a sound identifier is a custom sound ID
 * Custom sound IDs follow the pattern: userId_soundName_timestamp
 * @param {string} identifier - The sound identifier to check
 * @returns {boolean} True if it's a custom sound ID
 */
function isCustomSoundId(identifier) {
  // Custom sound IDs contain underscores and are longer than typical pre-packaged names
  // Pattern: userId_soundName_timestamp (e.g., "7709518_mj_beat_it_1756827174626")
  const parts = identifier.split("_");
  return parts.length >= 3 && /^\d+$/.test(parts[0]); // First part should be numeric user ID
}

/**
 * Get a list of all available sounds (pre-packaged + custom) for current user
 * This will be useful for populating dropdowns
 * @returns {Promise<Array>} Array of sound objects with { id, name, type, isCustom }
 */
export async function getAllAvailableSounds() {
  const sounds = [];

  try {
    // Add pre-packaged sounds
    const prePackagedSounds = await getPrePackagedSounds();
    sounds.push(
      ...prePackagedSounds.map((soundName) => ({
        id: soundName,
        name: formatSoundName(soundName),
        type: "prepackaged",
        isCustom: false,
      }))
    );

    // Add custom sounds
    const { getAllAudioFiles } = await import("./audioStorage.js");
    const customSounds = await getAllAudioFiles();
    sounds.push(
      ...customSounds.map((audio) => ({
        id: audio.id,
        name: audio.name,
        type: "custom",
        isCustom: true,
      }))
    );
  } catch (error) {
    console.error("Error getting available sounds:", error);
  }

  return sounds;
}

/**
 * Get list of pre-packaged sound files
 * @returns {Promise<Array>} Array of sound file names
 */
async function getPrePackagedSounds() {
  // This mimics the logic from alerts.js populateSoundSelector()
  try {
    const soundsDir = await new Promise((resolve, reject) => {
      chrome.runtime.getPackageDirectoryEntry((root) => {
        root.getDirectory("sounds", {}, (dir) => resolve(dir), reject);
      });
    });

    const soundFiles = await new Promise((resolve, reject) => {
      const reader = soundsDir.createReader();
      const files = [];

      function readEntries() {
        reader.readEntries((entries) => {
          if (entries.length) {
            entries.forEach((entry) => {
              if (entry.isFile && entry.name.endsWith(".mp3")) {
                files.push(entry.name.replace(".mp3", ""));
              }
            });
            readEntries();
          } else {
            resolve(files);
          }
        }, reject);
      }
      readEntries();
    });

    return soundFiles.sort();
  } catch (error) {
    console.error("Error reading pre-packaged sounds:", error);
    // Fallback list
    return ["eastern_whip", "chime", "marimba"];
  }
}

/**
 * Format sound name for display (replace underscores, capitalize)
 * @param {string} soundName - Raw sound name
 * @returns {string} Formatted name
 */
function formatSoundName(soundName) {
  return soundName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}
