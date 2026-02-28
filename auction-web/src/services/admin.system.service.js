import * as systemSettingModel from "../models/systemSetting.model.js";

/**
 * Admin System Service
 * Encapsulates business logic for system settings management.
 * Follows Single Responsibility Principle by separating business logic from HTTP handling.
 */

/**
 * Default system settings configuration.
 * Provides fallback values when database settings are not yet configured.
 */
export const DEFAULT_SETTINGS = {
  new_product_limit_minutes: 60,
  auto_extend_trigger_minutes: 5,
  auto_extend_duration_minutes: 10,
};

/**
 * Converts settings array from database to a structured settings object.
 * Applies default values for any missing settings.
 * @param {Array} settingsArray - Array of {key, value} objects from database
 * @returns {Object} Settings object with all keys and their values
 */
function convertSettingsArrayToObject(settingsArray) {
  const settings = { ...DEFAULT_SETTINGS };

  if (settingsArray && settingsArray.length > 0) {
    settingsArray.forEach((setting) => {
      settings[setting.key] = parseInt(setting.value);
    });
  }

  return settings;
}

/**
 * Retrieves all system settings with defaults applied.
 * @returns {Promise<Object>} Settings object with all configured values
 */
export async function getAllSettings() {
  try {
    const settingsArray = await systemSettingModel.getAllSettings();
    return convertSettingsArrayToObject(settingsArray);
  } catch (error) {
    console.error("Error fetching settings from database:", error);
    // Return defaults if database query fails
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Validates a setting key and value.
 * @param {string} key - Setting key to validate
 * @param {any} value - Setting value to validate
 * @returns {Object} Validation result {isValid: boolean, error: string}
 */
function validateSetting(key, value) {
  // Check if key is a valid setting
  if (!Object.keys(DEFAULT_SETTINGS).includes(key)) {
    return {
      isValid: false,
      error: `Invalid setting key: ${key}`,
    };
  }

  // Validate value is a positive number
  const numValue = parseInt(value);
  if (isNaN(numValue) || numValue <= 0) {
    return {
      isValid: false,
      error: `Setting ${key} must be a positive number`,
    };
  }

  // Additional business rule validations
  if (key === "auto_extend_trigger_minutes" && numValue > 60) {
    return {
      isValid: false,
      error: "Auto-extend trigger cannot exceed 60 minutes",
    };
  }

  if (key === "auto_extend_duration_minutes" && numValue > 30) {
    return {
      isValid: false,
      error: "Auto-extend duration cannot exceed 30 minutes",
    };
  }

  if (key === "new_product_limit_minutes" && numValue < 5) {
    return {
      isValid: false,
      error: "New product limit must be at least 5 minutes",
    };
  }

  return { isValid: true };
}

/**
 * Updates system settings with validation.
 * Only updates valid settings that are defined in DEFAULT_SETTINGS.
 * @param {Object} settingsData - Object containing setting keys and values to update
 * @returns {Promise<Object>} Result object {success: boolean, errors: Array, updatedCount: number}
 */
export async function updateSettings(settingsData) {
  const errors = [];
  let updatedCount = 0;

  try {
    for (const [key, value] of Object.entries(settingsData)) {
      // Validate the setting
      const validation = validateSetting(key, value);

      if (validation.isValid) {
        await systemSettingModel.updateSetting(key, value);
        updatedCount++;
      } else {
        errors.push(validation.error);
      }
    }

    return {
      success: errors.length === 0,
      errors,
      updatedCount,
    };
  } catch (error) {
    console.error("Error updating settings:", error);
    return {
      success: false,
      errors: ["Failed to update settings. Please try again."],
      updatedCount,
    };
  }
}

/**
 * Gets a specific setting value by key.
 * Returns default value if setting not found.
 * @param {string} key - Setting key to retrieve
 * @returns {Promise<number>} Setting value
 */
export async function getSettingByKey(key) {
  try {
    const setting = await systemSettingModel.getSetting(key);
    return setting ? parseInt(setting.value) : DEFAULT_SETTINGS[key];
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return DEFAULT_SETTINGS[key];
  }
}
