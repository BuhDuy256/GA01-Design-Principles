/**
 * Watchlist Service Layer
 * Handles watchlist business logic
 */
import * as watchListModel from '../models/watchlist.model.js';

/**
 * Add product to watchlist
 * @param {number} userId - User ID
 * @param {number} productId - Product ID
 * @returns {Promise<void>}
 */
export async function addToWatchlist(userId, productId) {
  const isInWatchlist = await watchListModel.isInWatchlist(userId, productId);

  if (!isInWatchlist) {
    await watchListModel.addToWatchlist(userId, productId);
  }
}

/**
 * Remove product from watchlist
 * @param {number} userId - User ID
 * @param {number} productId - Product ID
 * @returns {Promise<void>}
 */
export async function removeFromWatchlist(userId, productId) {
  await watchListModel.removeFromWatchlist(userId, productId);
}
