import * as upgradeRequestModel from "../models/upgradeRequest.model.js";
import upgradeService from "./upgrade.service.js";

/**
 * Admin Upgrade Service
 * Encapsulates admin-specific business logic for upgrade request management.
 * Follows Single Responsibility Principle by separating business logic from HTTP handling.
 */

/**
 * Retrieves all upgrade requests with user details.
 * @returns {Promise<Array>} List of upgrade requests
 */
export async function getAllUpgradeRequests() {
  return await upgradeRequestModel.loadAllUpgradeRequests();
}

/**
 * Retrieves a specific upgrade request by ID.
 * @param {number} requestId - The upgrade request ID
 * @returns {Promise<Object|null>} Upgrade request details or null if not found
 */
export async function getUpgradeRequestById(requestId) {
  const requests = await upgradeRequestModel.loadAllUpgradeRequests();
  return requests.find((req) => req.id === parseInt(requestId));
}

/**
 * Approves an upgrade request with validation.
 * Promotes the bidder to seller role within a transaction.
 * @param {number} requestId - The upgrade request ID
 * @param {number} bidderId - The bidder user ID
 * @returns {Promise<void>}
 * @throws {Error} If request not found or already processed
 */
export async function approveUpgradeRequest(requestId, bidderId) {
  // Validation
  if (!requestId || !bidderId) {
    throw new Error("Request ID and Bidder ID are required");
  }

  // Check if request exists and is pending
  const request = await getUpgradeRequestById(requestId);
  if (!request) {
    throw new Error("Upgrade request not found");
  }

  if (parseInt(request.bidder_id) !== parseInt(bidderId)) {
    throw new Error("Bidder ID mismatch - potential security issue");
  }

  if (request.status !== "pending") {
    throw new Error(`Request already ${request.status}. Cannot approve.`);
  }

  // Use the core upgrade service which handles the transaction
  await upgradeService.approveUpgradeRequest(requestId, bidderId);
}

/**
 * Rejects an upgrade request with validation.
 * @param {number} requestId - The upgrade request ID
 * @param {string} adminNote - Admin's rejection note (optional)
 * @returns {Promise<void>}
 * @throws {Error} If request not found or already processed
 */
export async function rejectUpgradeRequest(requestId, adminNote) {
  // Validation
  if (!requestId) {
    throw new Error("Request ID is required");
  }

  // Check if request exists and is pending
  const request = await getUpgradeRequestById(requestId);
  if (!request) {
    throw new Error("Upgrade request not found");
  }

  if (request.status !== "pending") {
    throw new Error(`Request already ${request.status}. Cannot reject.`);
  }

  // Use the core upgrade service which handles the transaction
  await upgradeService.rejectUpgradeRequest(
    requestId,
    adminNote || "No reason provided",
  );
}

/**
 * Gets statistics about upgrade requests.
 * @returns {Promise<Object>} Statistics object with counts
 */
export async function getUpgradeRequestStats() {
  const requests = await upgradeRequestModel.loadAllUpgradeRequests();

  return {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };
}
