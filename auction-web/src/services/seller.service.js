/**
 * seller.service.js
 *
 * Service layer for seller-specific operations.
 *
 * Responsibilities:
 *   - Manage product description updates (append, update, delete)
 *   - Verify seller ownership of products and updates
 *   - Cancel products with reason and bidder rating
 *
 * This module does NOT:
 *   - Handle HTTP request/response (no Express dependency)
 *   - Send notifications (delegated to notification.service.js)
 */

import * as productModel from "../models/product.model.js";
import * as productDescUpdateModel from "../models/productDescriptionUpdate.model.js";
import * as reviewModel from "../models/review.model.js";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Verify that a product belongs to a specific seller.
 * @param {number} productId - Product ID
 * @param {number} sellerId - Seller ID
 * @returns {Promise<Object>} Product if authorized
 * @throws {Error} If product not found or unauthorized
 */
async function _verifyProductOwnership(productId, sellerId) {
  const product = await productModel.findByProductId2(productId, null);
  if (!product) {
    const error = new Error("Product not found");
    error.code = "PRODUCT_NOT_FOUND";
    throw error;
  }
  if (product.seller_id !== sellerId) {
    const error = new Error("Unauthorized");
    error.code = "UNAUTHORIZED";
    throw error;
  }
  return product;
}

/**
 * Verify that a description update belongs to a seller's product.
 * @param {number} updateId - Update ID
 * @param {number} sellerId - Seller ID
 * @returns {Promise<Object>} Update and product if authorized
 * @throws {Error} If update not found or unauthorized
 */
async function _verifyUpdateOwnership(updateId, sellerId) {
  const update = await productDescUpdateModel.findById(updateId);
  if (!update) {
    const error = new Error("Update not found");
    error.code = "UPDATE_NOT_FOUND";
    throw error;
  }

  const product = await productModel.findByProductId2(update.product_id, null);
  if (!product || product.seller_id !== sellerId) {
    const error = new Error("Unauthorized");
    error.code = "UNAUTHORIZED";
    throw error;
  }

  return { update, product };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get description updates for a product owned by the seller.
 * @param {number} productId - Product ID
 * @param {number} sellerId - Seller ID
 * @returns {Promise<Array>} Description updates
 * @throws {Error} If unauthorized or not found
 */
export async function getDescriptionUpdates(productId, sellerId) {
  await _verifyProductOwnership(productId, sellerId);
  return await productDescUpdateModel.findByProductId(productId);
}

/**
 * Update a description update's content.
 * @param {number} updateId - Update ID
 * @param {number} sellerId - Seller ID
 * @param {string} content - New content
 * @returns {Promise<void>}
 * @throws {Error} If validation fails, unauthorized, or not found
 */
export async function updateDescriptionContent(updateId, sellerId, content) {
  if (!content || content.trim() === "") {
    const error = new Error("Content is required");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  await _verifyUpdateOwnership(updateId, sellerId);
  await productDescUpdateModel.updateContent(updateId, content.trim());
}

/**
 * Delete a description update.
 * @param {number} updateId - Update ID
 * @param {number} sellerId - Seller ID
 * @returns {Promise<void>}
 * @throws {Error} If unauthorized or not found
 */
export async function deleteDescriptionUpdate(updateId, sellerId) {
  await _verifyUpdateOwnership(updateId, sellerId);
  await productDescUpdateModel.deleteUpdate(updateId);
}

/**
 * Cancel a product and optionally rate the bidder negatively.
 * @param {Object} params - Cancellation parameters
 * @returns {Promise<Object>} Cancelled product
 * @throws {Error} If unauthorized or not found
 */
export async function cancelProductWithRating(params) {
  const { productId, sellerId, reason, highestBidderId } = params;

  // Verify ownership and cancel
  await _verifyProductOwnership(productId, sellerId);
  const product = await productModel.cancelProduct(productId, sellerId);

  // Create negative review if there's a bidder
  if (highestBidderId) {
    const reviewData = {
      reviewer_id: sellerId,
      reviewee_id: highestBidderId,
      product_id: productId,
      rating: -1,
      comment: reason || "Auction cancelled by seller",
    };
    await reviewModel.createReview(reviewData);
  }

  return product;
}
