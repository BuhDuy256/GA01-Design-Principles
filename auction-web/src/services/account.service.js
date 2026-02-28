import * as userModel from "../models/user.model.js";
import * as upgradeRequestModel from "../models/upgradeRequest.model.js";
import upgradeService from "./upgrade.service.js";

/**
 * Account Service
 * Encapsulates business logic for user account management operations.
 * Follows Single Responsibility Principle by separating business logic from HTTP handling.
 */

/**
 * Retrieves user profile by ID.
 * @param {number} userId - The user ID
 * @returns {Promise<Object|null>} User profile or null if not found
 */
export async function getUserProfile(userId) {
  return await userModel.findById(userId);
}

/**
 * Retrieves upgrade request status for a user.
 * @param {number} userId - The user ID
 * @returns {Promise<Object|null>} Upgrade request or null if not found
 */
export async function getUserUpgradeRequest(userId) {
  return await upgradeRequestModel.findByUserId(userId);
}

/**
 * Submits an upgrade request for a bidder.
 * Validates user eligibility before submitting.
 * @param {number} userId - The user ID
 * @returns {Promise<void>}
 * @throws {Error} If user not found, already submitted, or not eligible
 */
export async function submitUpgradeRequest(userId) {
  // Check if user exists
  const user = await userModel.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Check if user is already a seller or admin
  if (user.role === "seller" || user.role === "admin") {
    throw new Error("You are already a seller or admin");
  }

  // Check if already has a pending request
  const existingRequest = await upgradeRequestModel.findByUserId(userId);
  if (existingRequest) {
    if (existingRequest.status === "pending") {
      throw new Error("You already have a pending upgrade request");
    }
    if (existingRequest.status === "approved") {
      throw new Error("Your upgrade request was already approved");
    }
  }

  // Submit the request via upgrade service
  await upgradeService.submitUpgradeRequest(userId);
}

/**
 * Checks if user has a pending upgrade request.
 * @param {number} userId - The user ID
 * @returns {Promise<boolean>} True if has pending request
 */
export async function hasPendingUpgradeRequest(userId) {
  const request = await upgradeRequestModel.findByUserId(userId);
  return request && request.status === "pending";
}
