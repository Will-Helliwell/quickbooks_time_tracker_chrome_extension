// Global application state
export const AppState = {
  userProfile: null,

  /**
   * Sets the user profile in global state
   * @param {Object} profile - The user profile object
   */
  setUserProfile(profile) {
    this.userProfile = profile;
  },

  /**
   * Gets the user profile from global state
   * @returns {Object|null} The user profile object or null if not set
   */
  getUserProfile() {
    return this.userProfile;
  },
};