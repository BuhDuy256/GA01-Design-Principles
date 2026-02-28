/**
 * auction.service.js
 *
 * Service layer that orchestrates the auction bidding flow.
 * Responsibilities:
 *   - Manage DB transactions
 *   - Pre-fetch required data for bid-engine validation
 *   - Call bid-engine pure functions
 *   - Persist bid results
 *   - Dispatch email notifications (fire-and-forget)
 *
 * This module depends on:
 *   - Infrastructure: db, sendMail
 *   - Models: reviewModel, systemSettingModel, userModel
 *   - Domain logic: bid-engine.js (pure)
 *
 * Routes depend ONLY on this service — they do not touch DB or models directly
 * for bidding operations.
 *
 * Related issues: #4 (SRP), #5 (OCP), #8 (DIP)
 */

import db from '../../utils/db.js';
import * as reviewModel from '../../models/review.model.js';
import * as systemSettingModel from '../../models/systemSetting.model.js';
import * as userModel from '../../models/user.model.js';
import { createOrderFromAuction } from '../order.service.js';
import * as notificationService from '../notification.service.js';
import {
  validateBidEligibility,
  validateBidAmount,
  validateBuyNowEligibility,
  computeAutoExtend,
  computeAutoBidResult
} from './bid-engine.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Place a bid on a product.
 * Runs inside a single DB transaction with row-level locking.
 *
 * @param {{ productId: number, userId: number, bidAmount: number }}
 * @returns {Promise<object>} Bid result (used by route to build response + send emails)
 */
export async function placeBid({ productId, userId, bidAmount }) {
  const result = await db.transaction(async (trx) => {
    // 1. Lock product row (prevents concurrent bid races)
    const product = await trx('products')
      .where('id', productId)
      .forUpdate()
      .first();

    if (!product) throw new Error('Product not found');

    const previousHighestBidderId = product.highest_bidder_id;
    const previousPrice = parseFloat(product.current_price || product.starting_price);
    const now = new Date();

    // 2. Pre-fetch eligibility data
    const [isRejectedRow, ratingData, userReviews] = await Promise.all([
      trx('rejected_bidders').where({ product_id: productId, bidder_id: userId }).first(),
      reviewModel.calculateRatingPoint(userId),
      reviewModel.getReviewsByUserId(userId)
    ]);

    // 3. Validate eligibility (pure — no I/O)
    const eligibility = validateBidEligibility({
      product,
      userId,
      ratingPoint: ratingData?.rating_point ?? null,
      hasReviews: userReviews.length > 0,
      isRejected: !!isRejectedRow,
      now
    });
    if (!eligibility.eligible) throw new Error(eligibility.reason);

    // 4. Validate bid amount (pure — no I/O)
    const currentPrice = parseFloat(product.current_price || product.starting_price);
    const minIncrement = parseFloat(product.step_price);
    const amountCheck = validateBidAmount(currentPrice, bidAmount, minIncrement);
    if (!amountCheck.valid) throw new Error(amountCheck.reason);

    // 5. Compute auto-extend (pure — no I/O beyond settings fetch)
    const settings = await systemSettingModel.getSettings();
    const extendedEndTime = computeAutoExtend(product, now, settings);
    // Temporarily apply extended time so computeAutoBidResult sees updated end_at
    if (extendedEndTime) product.end_at = extendedEndTime;

    // 6. Compute bid outcome (pure — no I/O)
    const buyNowPrice = product.buy_now_price ? parseFloat(product.buy_now_price) : null;
    const {
      newCurrentPrice,
      newHighestBidderId,
      newHighestMaxPrice,
      shouldCreateHistory,
      buyNowTriggered
    } = computeAutoBidResult({ product, userId, bidAmount, minIncrement, buyNowPrice });

    const productSold = buyNowTriggered;

    // 7. Persist: update product
    const updateData = {
      current_price: newCurrentPrice,
      highest_bidder_id: newHighestBidderId,
      highest_max_price: newHighestMaxPrice
    };
    if (productSold) {
      // Buy-now reached — close auction immediately
      updateData.end_at = new Date();
      updateData.closed_at = new Date();
      // is_sold stays NULL → product enters PENDING state (awaiting payment)
    } else if (extendedEndTime) {
      updateData.end_at = extendedEndTime;
    }
    await trx('products').where('id', productId).update(updateData);

    // 8. Persist: bidding history (only when price actually changed)
    if (shouldCreateHistory) {
      await trx('bidding_history').insert({
        product_id: productId,
        bidder_id: newHighestBidderId,
        current_price: newCurrentPrice
      });
    }

    // 9. Persist: upsert auto_bidding record for the submitting user
    await trx.raw(`
      INSERT INTO auto_bidding (product_id, bidder_id, max_price)
      VALUES (?, ?, ?)
      ON CONFLICT (product_id, bidder_id)
      DO UPDATE SET
        max_price  = EXCLUDED.max_price,
        created_at = NOW()
    `, [productId, userId, bidAmount]);

    return {
      newCurrentPrice,
      newHighestBidderId,
      userId,
      bidAmount,
      productSold,
      autoExtended: !!extendedEndTime,
      newEndTime: extendedEndTime,
      productName: product.name,
      sellerId: product.seller_id,
      previousHighestBidderId,
      previousPrice,
      priceChanged: previousPrice !== newCurrentPrice
    };
  });

  // Domain transition: ACTIVE → PENDING triggered by buy-now price hit.
  // Order must be created immediately when auction closes, not lazily in GET /complete-order.
  // createOrderFromAuction is idempotent — safe to call even if a duplicate trigger occurs.
  if (result.productSold) {
    await createOrderFromAuction({
      productId,
      buyerId: result.newHighestBidderId,
      sellerId: result.sellerId,
      finalPrice: result.newCurrentPrice
    });
  }

  return result;
}

/**
 * Execute a Buy Now purchase.
 * Validates eligibility, closes the auction, and records the transaction.
 *
 * @param {{ productId: number|string, userId: number }}
 */
export async function executeBuyNow({ productId, userId }) {
  // Variables captured from the transaction to support post-transaction order creation.
  let _sellerId;
  let _finalPrice;

  await db.transaction(async (trx) => {
    const product = await trx('products')
      .leftJoin('users as seller', 'products.seller_id', 'seller.id')
      .where('products.id', productId)
      .select('products.*', 'seller.fullname as seller_name')
      .first();

    if (!product) throw new Error('Product not found');

    const now = new Date();
    const isRejectedRow = await trx('rejected_bidders')
      .where({ product_id: productId, bidder_id: userId })
      .first();

    const ratingData = await reviewModel.calculateRatingPoint(userId);
    const ratingPoint = ratingData?.rating_point ?? 0;

    const eligibility = validateBuyNowEligibility({
      product,
      userId,
      isRejected: !!isRejectedRow,
      ratingPoint,
      now
    });
    if (!eligibility.eligible) throw new Error(eligibility.reason);

    const buyNowPrice = parseFloat(product.buy_now_price);

    await trx('products')
      .where('id', productId)
      .update({
        current_price: buyNowPrice,
        highest_bidder_id: userId,
        highest_max_price: buyNowPrice,
        end_at: now,
        closed_at: now,
        is_buy_now_purchase: true
      });

    // Record Buy Now as a bidding history entry (flagged separately from regular bids)
    await trx('bidding_history').insert({
      product_id: productId,
      bidder_id: userId,
      current_price: buyNowPrice,
      is_buy_now: true
    });
    // Note: no auto_bidding upsert for Buy Now — direct purchase, not proxy bid.

    // Capture values for post-transaction order creation.
    _sellerId = product.seller_id;
    _finalPrice = buyNowPrice;
  });

  // Domain transition: ACTIVE → PENDING (Buy Now path).
  // Order is created immediately after the auction closes so that GET /complete-order
  // always finds an existing order — it never needs to create one.
  // createOrderFromAuction is idempotent — safe to call even after a scheduler retry.
  await createOrderFromAuction({
    productId,
    buyerId: userId,
    sellerId: _sellerId,
    finalPrice: _finalPrice
  });
}

/**
 * Send bid notification emails to seller, current bidder, and previous bidder.
 * Must be called fire-and-forget from the route (do NOT await).
 *
 * Responsibilities here: fetch user contact data, enrich result, delegate to
 * notification.service — which owns all email content and template logic.
 *
 * @param {{ result: object, productId: number, productUrl: string }}
 */
export async function sendBidNotifications({ result, productId, productUrl }) {
  try {
    const [seller, currentBidder, previousBidder] = await Promise.all([
      userModel.findById(result.sellerId),
      userModel.findById(result.userId),
      result.previousHighestBidderId && result.previousHighestBidderId !== result.userId
        ? userModel.findById(result.previousHighestBidderId)
        : Promise.resolve(null)
    ]);

    // Enrich result with resolved contact info.
    // notification.service is deliberately kept free of DB/model dependencies.
    const enrichedResult = {
      ...result,
      sellerEmail: seller?.email,
      sellerName: seller?.fullname,
      currentBidderEmail: currentBidder?.email,
      currentBidderName: currentBidder?.fullname,
      previousBidderEmail: previousBidder?.email,
      previousBidderName: previousBidder?.fullname
    };

    await notificationService.sendBidNotifications({ result: enrichedResult, productId, productUrl });
  } catch (emailError) {
    console.error('Failed to send bid notification emails:', emailError);
  }
