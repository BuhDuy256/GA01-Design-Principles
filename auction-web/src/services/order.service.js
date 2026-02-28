/**
 * order.service.js
 *
 * Service layer for the Order domain.
 *
 * Responsibilities:
 *   - Create an Order when an auction enters the PENDING state.
 *   - Provide idempotent order creation to prevent duplicates.
 *   - Expose a minimal read API for callers that should not touch the model directly.
 *
 * This module does NOT:
 *   - Contain auction classification logic (see auction-state.js).
 *   - Know about HTTP request/response (no Express dependency).
 *   - Handle payment invoice or file-upload flows (those remain in order.route.js).
 *
 * Invariant enforced here:
 *   An Order record for a given product must be created EXACTLY ONCE,
 *   at the moment the auction transitions into the PENDING state — regardless of
 *   which code path triggers the transition (placeBid buy-now, executeBuyNow,
 *   or time-based expiry via auctionEndNotifier).
 *
 * Related issues: #9 (SRP — Bidding ↔ Order coupling), #1/#3/#13 (Route cleanup)
 */

import * as orderModel from '../models/order.model.js';
import * as reviewModel from '../models/review.model.js';
import db from '../utils/db.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an Order that corresponds to a completed auction.
 *
 * IDEMPOTENT: if an Order already exists for the given productId, the existing
 * record is returned without performing any write. This prevents duplicate orders
 * regardless of how many times the function is called for the same product
 * (e.g., race between bid-engine and auctionEndNotifier on a slow scheduler cycle).
 *
 * @param {{ productId: number|string, buyerId: number, sellerId: number, finalPrice: number }}
 * @returns {Promise<object>} The new or existing Order record.
 */
export async function createOrderFromAuction({ productId, buyerId, sellerId, finalPrice }) {
  // Guard: do not create orders with missing data
  if (!productId || !buyerId || !sellerId) {
    throw new Error(
      `createOrderFromAuction: missing required fields ` +
      `(productId=${productId}, buyerId=${buyerId}, sellerId=${sellerId})`
    );
  }

  // Idempotency check — prevents duplicate Order entities
  const existing = await orderModel.findByProductId(productId);
  if (existing) {
    return existing;
  }

  const order = await orderModel.createOrder({
    product_id: productId,
    buyer_id: buyerId,
    seller_id: sellerId,
    final_price: finalPrice ?? 0
  });

  return order;
}

/**
 * Retrieve an existing Order by its associated product.
 * Pure read — no side effects.
 *
 * @param {number|string} productId
 * @returns {Promise<object|null>} Order record, or null if not found.
 */
export async function getOrderByProductId(productId) {
  return orderModel.findByProductId(productId);
}

// ---------------------------------------------------------------------------
// Rating & transaction completion
// ---------------------------------------------------------------------------

/**
 * Submit a rating (positive / negative) for the counterparty of an order.
 * If both parties have now rated (or skipped), marks the order as completed
 * and stamps the product as sold.
 *
 * IDEMPOTENT on duplicate calls: an existing review is updated rather than
 * re-created.
 *
 * @param {{ orderId: string, userId: number, rating: string, comment: string|null }}
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function submitRating({ orderId, userId, rating, comment }) {
  const order = await orderModel.findById(orderId);
  if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
    throw Object.assign(new Error('Unauthorized'), { status: 403 });
  }

  const isBuyer = order.buyer_id === userId;
  const reviewerId = userId;
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;
  const ratingValue = rating === 'positive' ? 1 : -1;

  const existingReview = await reviewModel.findByReviewerAndProduct(reviewerId, order.product_id);
  if (existingReview) {
    await reviewModel.updateReview(reviewerId, order.product_id, {
      rating: ratingValue,
      comment: comment || null
    });
  } else {
    await reviewModel.createReview({
      reviewerId,
      revieweeId,
      productId: order.product_id,
      rating: ratingValue,
      comment: comment || null
    });
  }

  await _finalizeIfBothCompleted(order, userId);
  return { success: true, message: 'Rating submitted successfully' };
}

/**
 * Skip rating for an order. Creates a review record with rating=0
 * ("skipped" sentinel value) if one does not already exist.
 * If both parties have now rated or skipped, marks the order as completed.
 *
 * @param {{ orderId: string, userId: number }}
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function completeTransaction({ orderId, userId }) {
  const order = await orderModel.findById(orderId);
  if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
    throw Object.assign(new Error('Unauthorized'), { status: 403 });
  }

  const isBuyer = order.buyer_id === userId;
  const reviewerId = userId;
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

  const existingReview = await reviewModel.findByReviewerAndProduct(reviewerId, order.product_id);
  if (!existingReview) {
    await reviewModel.createReview({
      reviewerId,
      revieweeId,
      productId: order.product_id,
      rating: 0, // 0 = skipped
      comment: null
    });
  }

  await _finalizeIfBothCompleted(order, userId);
  return { success: true, message: 'Transaction completed' };
}

/**
 * Close an order and mark the associated product as sold if both parties
 * have left a review (any rating value, including 0 = skipped).
 * Private helper shared by submitRating and completeTransaction.
 */
async function _finalizeIfBothCompleted(order, userId) {
  const [buyerReview, sellerReview] = await Promise.all([
    reviewModel.getProductReview(order.buyer_id, order.seller_id, order.product_id),
    reviewModel.getProductReview(order.seller_id, order.buyer_id, order.product_id)
  ]);

  if (buyerReview && sellerReview) {
    await orderModel.updateStatus(order.id, 'completed', userId);
    await db('products').where('id', order.product_id).update({
      is_sold: true,
      closed_at: new Date()
    });
  }
}
