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
 * This module is intentionally narrow. It does NOT:
 *   - Contain auction classification logic (see auction-state.js).
 *   - Know about HTTP request/response (no Express dependency).
 *   - Handle payment, shipping, or rating flows (those remain in their own models/routes).
 *
 * Invariant enforced here:
 *   An Order record for a given product must be created EXACTLY ONCE,
 *   at the moment the auction transitions into the PENDING state — regardless of
 *   which code path triggers the transition (placeBid buy-now, executeBuyNow,
 *   or time-based expiry via auctionEndNotifier).
 *
 * Related issue: #9 (SRP — Bidding ↔ Order coupling)
 */

import * as orderModel from '../models/order.model.js';

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
