/**
 * reputation.service.js
 *
 * Service layer for user reputation management.
 *
 * Responsibilities:
 *   - Retrieve user reputation data (rating points, reviews, statistics)
 *   - Submit and update ratings for sellers
 *   - Calculate review statistics
 *   - Convert rating string values to numeric values
 *
 * This module does NOT:
 *   - Handle HTTP request/response (no Express dependency)
 *   - Manage session data directly
 */

import * as reviewModel from "../models/review.model.js";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Compute display statistics from a flat array of review records.
 * @param {object[]} reviews
 * @returns {{ totalReviews: number, positiveReviews: number, negativeReviews: number }}
 */
function _computeStats(reviews) {
  return {
    totalReviews: reviews.length,
    positiveReviews: reviews.filter((r) => r.rating === 1).length,
    negativeReviews: reviews.filter((r) => r.rating === -1).length,
  };
}

/**
 * Convert rating string to numeric value.
 * @param {string} rating - 'positive' or 'negative'
 * @returns {number} 1 for positive, -1 for negative
 */
function _convertRatingToValue(rating) {
  return rating === "positive" ? 1 : -1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get current user's reputation data including rating point, reviews, and statistics.
 * @param {number} userId - Current user ID
 * @returns {Promise<Object>} Reputation data
 */
export async function getUserReputationData(userId) {
  const [ratingData, reviews] = await Promise.all([
    reviewModel.calculateRatingPoint(userId),
    reviewModel.getReviewsByUserId(userId),
  ]);

  const stats = _computeStats(reviews);

  return {
    rating_point: ratingData ? ratingData.rating_point : 0,
    reviews,
    ...stats,
  };
}

/**
 * Submit or update a seller rating.
 * Handles both creation and update in a single operation.
 * @param {Object} params - Rating parameters
 * @returns {Promise<Object>} Result with success status
 */
export async function rateSellerForProduct(params) {
  const { reviewerId, sellerId, productId, rating, comment } = params;

  const ratingValue = _convertRatingToValue(rating);

  // Check if already rated
  const existingReview = await reviewModel.findByReviewerAndProduct(
    reviewerId,
    productId,
  );

  if (existingReview) {
    // Update existing review
    await reviewModel.updateByReviewerAndProduct(reviewerId, productId, {
      rating: ratingValue,
      comment: comment || null,
    });
    return { success: true, action: "updated" };
  } else {
    // Create new review
    await reviewModel.create({
      reviewer_id: reviewerId,
      reviewed_user_id: sellerId,
      product_id: productId,
      rating: ratingValue,
      comment: comment || null,
    });
    return { success: true, action: "created" };
  }
}
