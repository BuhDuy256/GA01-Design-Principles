/**
 * Rating Service
 * Centralizes rating calculation and statistics aggregation logic
 */

import * as reviewModel from '../models/review.model.js';

async function getUserRatingSummary(userId) {
  // Get rating point
  const ratingData = await reviewModel.calculateRatingPoint(userId);
  const rating_point = ratingData ? ratingData.rating_point : 0;

  // Get all reviews
  const reviews = await reviewModel.getReviewsByUserId(userId);

  // Calculate statistics
  const totalReviews = reviews.length;
  const positiveReviews = reviews.filter(r => r.rating === 1).length;
  const negativeReviews = reviews.filter(r => r.rating === -1).length;

  return {
    rating_point,
    totalReviews,
    positiveReviews,
    negativeReviews,
    reviews
  };
}

export { getUserRatingSummary };
