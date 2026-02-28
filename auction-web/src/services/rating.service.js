/**
 * rating.service.js
 *
 * Service layer for the Rating / Review domain, as exposed to route handlers.
 *
 * Responsibilities:
 *   - Aggregate rating-page data for seller and bidder profile views.
 *   - Compute review statistics (total, positive, negative counts).
 *   - Apply display-layer masking rules (masked bidder name).
 *
 * This module does NOT:
 *   - Handle HTTP request/response (no Express dependency).
 *   - Contain bid or order lifecycle logic.
 *   - Send emails (see notification.service.js).
 *
 * Related issues: #1, #3, #13 (Route cleanup — separation of aggregation from HTTP layer)
 */

import * as userModel from '../models/user.model.js';
import * as reviewModel from '../models/review.model.js';

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
    positiveReviews: reviews.filter(r => r.rating === 1).length,
    negativeReviews: reviews.filter(r => r.rating === -1).length
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Aggregate all data required to render the seller ratings page.
 * Returns null if the seller does not exist (caller should redirect).
 *
 * @param {number} sellerId
 * @returns {Promise<{
 *   sellerName: string,
 *   rating_point: number,
 *   totalReviews: number,
 *   positiveReviews: number,
 *   negativeReviews: number,
 *   reviews: object[]
 * } | null>}
 */
export async function getSellerRatingData(sellerId) {
  const seller = await userModel.findById(sellerId);
  if (!seller) return null;

  const [ratingData, reviews] = await Promise.all([
    reviewModel.calculateRatingPoint(sellerId),
    reviewModel.getReviewsByUserId(sellerId)
  ]);

  const stats = _computeStats(reviews);

  return {
    sellerName: seller.fullname,
    rating_point: ratingData ? ratingData.rating_point : 0,
    ...stats,
    reviews
  };
}

/**
 * Aggregate all data required to render the bidder ratings page.
 * Bidder name is masked (every odd-position character replaced with '*').
 * Returns null if the bidder does not exist (caller should redirect).
 *
 * @param {number} bidderId
 * @returns {Promise<{
 *   bidderName: string,
 *   rating_point: number,
 *   totalReviews: number,
 *   positiveReviews: number,
 *   negativeReviews: number,
 *   reviews: object[]
 * } | null>}
 */
export async function getBidderRatingData(bidderId) {
  const bidder = await userModel.findById(bidderId);
  if (!bidder) return null;

  const [ratingData, reviews] = await Promise.all([
    reviewModel.calculateRatingPoint(bidderId),
    reviewModel.getReviewsByUserId(bidderId)
  ]);

  const stats = _computeStats(reviews);

  const maskedName = bidder.fullname
    ? bidder.fullname.split('').map((char, index) => (index % 2 === 0 ? char : '*')).join('')
    : '';

  return {
    bidderName: maskedName,
    rating_point: ratingData ? ratingData.rating_point : 0,
    ...stats,
    reviews
  };
}
