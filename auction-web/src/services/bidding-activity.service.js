import * as watchlistModel from "../models/watchlist.model.js";
import * as autoBiddingModel from "../models/autoBidding.model.js";
import * as reviewModel from "../models/review.model.js";

/**
 * Bidding Activity Service
 * Encapsulates business logic for bidding activities (watchlist, bidding, won auctions).
 * Follows Single Responsibility Principle by separating business logic from HTTP handling.
 */

/**
 * Calculates pagination metadata.
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} totalCount - Total number of items
 * @returns {Object} Pagination metadata
 */
function calculatePagination(page, limit, totalCount) {
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;

  if (to > totalCount) to = totalCount;
  if (totalCount === 0) {
    from = 0;
    to = 0;
  }

  return {
    currentPage: page,
    totalPages: nPages,
    from,
    to,
    totalCount,
  };
}

/**
 * Retrieves watchlist products with pagination.
 * @param {number} userId - The user ID
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 3)
 * @returns {Promise<Object>} Watchlist products with pagination metadata
 */
export async function getWatchlistWithPagination(userId, page = 1, limit = 3) {
  const offset = (page - 1) * limit;

  const watchlistProducts = await watchlistModel.searchPageByUserId(
    userId,
    limit,
    offset,
  );
  const total = await watchlistModel.countByUserId(userId);
  const totalCount = Number(total.count);

  const pagination = calculatePagination(page, limit, totalCount);

  return {
    products: watchlistProducts,
    ...pagination,
  };
}

/**
 * Retrieves products the user is currently bidding on.
 * @param {number} userId - The user ID
 * @returns {Promise<Array>} List of bidding products
 */
export async function getBiddingProducts(userId) {
  return await autoBiddingModel.getBiddingProductsByBidderId(userId);
}

/**
 * Retrieves auctions won by the user with seller rating information.
 * Enriches each product with rating status and details.
 * @param {number} userId - The user ID
 * @returns {Promise<Array>} List of won auctions with rating information
 */
export async function getWonAuctionsWithRatings(userId) {
  const wonAuctions = await autoBiddingModel.getWonAuctionsByBidderId(userId);

  // Enrich each product with rating information
  for (let product of wonAuctions) {
    const review = await reviewModel.findByReviewerAndProduct(
      userId,
      product.id,
    );

    // Only show rating if it's not 0 (actual rating, not skip)
    if (review && review.rating !== 0) {
      product.has_rated_seller = true;
      product.seller_rating = review.rating === 1 ? "positive" : "negative";
      product.seller_rating_comment = review.comment;
    } else {
      product.has_rated_seller = false;
    }
  }

  return wonAuctions;
}

/**
 * Counts total watchlist items for a user.
 * @param {number} userId - The user ID
 * @returns {Promise<number>} Total count
 */
export async function getWatchlistCount(userId) {
  const result = await watchlistModel.countByUserId(userId);
  return Number(result.count);
}
