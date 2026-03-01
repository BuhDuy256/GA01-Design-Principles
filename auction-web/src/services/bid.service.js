/**
 * Bid Service Layer
 * Handles all bidding business logic including validation, authorization,
 * automatic bidding algorithm, and email notifications
 */
import db from '../utils/db.js';
import * as reviewModel from '../models/review.model.js';
import * as systemSettingModel from '../models/systemSetting.model.js';
import { sendBidNotifications } from './email.service.js';

/**
 * Process a bid with complete validation, authorization, and business logic
 * 
 * @param {Object} params - Bid parameters
 * @param {number} params.userId - User placing the bid
 * @param {number} params.productId - Product ID
 * @param {number} params.bidAmount - Bid amount (already parsed)
 * @param {string} params.productUrl - Product URL for email notifications
 * @returns {Promise<Object>} Result object with bid outcome
 * @throws {Error} If validation or business rules fail
 */
export async function placeBid({ userId, productId, bidAmount, productUrl }) {
  // Use transaction with row-level locking to prevent race conditions
  const result = await db.transaction(async (trx) => {
    // 1. Lock the product row for update to prevent concurrent modifications
    const product = await trx('products')
      .where('id', productId)
      .forUpdate() // Row-level lock
      .first();

    if (!product) {
      throw new Error('Product not found');
    }

    // Store previous state for email notifications
    const previousHighestBidderId = product.highest_bidder_id;
    const previousPrice = parseFloat(product.current_price || product.starting_price);

    // === VALIDATION & AUTHORIZATION CHECKS ===

    // 2. Check if product is already sold
    if (product.is_sold === true) {
      throw new Error('This product has already been sold');
    }

    // 3. Check if seller cannot bid on their own product
    if (product.seller_id === userId) {
      throw new Error('You cannot bid on your own product');
    }

    // 4. Check if bidder has been rejected
    const isRejected = await trx('rejected_bidders')
      .where('product_id', productId)
      .where('bidder_id', userId)
      .first();

    if (isRejected) {
      throw new Error('You have been rejected from bidding on this product by the seller');
    }

    // 5. Check rating requirements
    const ratingPoint = await reviewModel.calculateRatingPoint(userId);
    const userReviews = await reviewModel.getReviewsByUserId(userId);
    const hasReviews = userReviews.length > 0;

    if (!hasReviews) {
      // User has no reviews yet (unrated)
      if (!product.allow_unrated_bidder) {
        throw new Error('This seller does not allow unrated bidders to bid on this product.');
      }
    } else if (ratingPoint.rating_point < 0) {
      throw new Error('You are not eligible to place bids due to your rating.');
    } else if (ratingPoint.rating_point === 0) {
      throw new Error('You are not eligible to place bids due to your rating.');
    } else if (ratingPoint.rating_point <= 0.8) {
      throw new Error('Your rating point is not greater than 80%. You cannot place bids.');
    }

    // 6. Check if auction has ended
    const now = new Date();
    const endDate = new Date(product.end_at);
    if (now > endDate) {
      throw new Error('Auction has ended');
    }

    // 7. Validate bid amount against current price
    const currentPrice = parseFloat(product.current_price || product.starting_price);

    if (bidAmount <= currentPrice) {
      throw new Error(`Bid must be higher than current price (${currentPrice.toLocaleString()} VND)`);
    }

    // 8. Check minimum bid increment
    const minIncrement = parseFloat(product.step_price);
    if (bidAmount < currentPrice + minIncrement) {
      throw new Error(`Bid must be at least ${minIncrement.toLocaleString()} VND higher than current price`);
    }

    // === AUTO-EXTEND LOGIC ===

    let extendedEndTime = null;
    if (product.auto_extend) {
      const settings = await systemSettingModel.getSettings();
      const triggerMinutes = settings?.auto_extend_trigger_minutes;
      const extendMinutes = settings?.auto_extend_duration_minutes;

      const endTime = new Date(product.end_at);
      const minutesRemaining = (endTime - now) / (1000 * 60);

      if (minutesRemaining <= triggerMinutes) {
        extendedEndTime = new Date(endTime.getTime() + extendMinutes * 60 * 1000);
        product.end_at = extendedEndTime; // Update for subsequent checks
      }
    }

    // === AUTOMATIC BIDDING ALGORITHM ===

    let newCurrentPrice;
    let newHighestBidderId;
    let newHighestMaxPrice;
    let shouldCreateHistory = true;

    const buyNowPrice = product.buy_now_price ? parseFloat(product.buy_now_price) : null;
    let buyNowTriggered = false;

    // Special handling: If existing highest bidder already reached buy_now price
    if (buyNowPrice && product.highest_bidder_id && product.highest_max_price && product.highest_bidder_id !== userId) {
      const currentHighestMaxPrice = parseFloat(product.highest_max_price);

      if (currentHighestMaxPrice >= buyNowPrice) {
        newCurrentPrice = buyNowPrice;
        newHighestBidderId = product.highest_bidder_id;
        newHighestMaxPrice = currentHighestMaxPrice;
        buyNowTriggered = true;
      }
    }

    // Normal auto-bidding logic (if buy_now not triggered)
    if (!buyNowTriggered) {
      // Case 0: User is already the highest bidder
      if (product.highest_bidder_id === userId) {
        // Just update max_price, don't change current_price
        newCurrentPrice = parseFloat(product.current_price || product.starting_price);
        newHighestBidderId = userId;
        newHighestMaxPrice = bidAmount;
        shouldCreateHistory = false; // No price change
      }
      // Case 1: First bid (no previous bidder)
      else if (!product.highest_bidder_id || !product.highest_max_price) {
        newCurrentPrice = product.starting_price;
        newHighestBidderId = userId;
        newHighestMaxPrice = bidAmount;
      }
      // Case 2: There is a previous bidder
      else {
        const currentHighestMaxPrice = parseFloat(product.highest_max_price);
        const currentHighestBidderId = product.highest_bidder_id;

        if (bidAmount < currentHighestMaxPrice) {
          // Previous bidder wins
          newCurrentPrice = bidAmount;
          newHighestBidderId = currentHighestBidderId;
          newHighestMaxPrice = currentHighestMaxPrice;
        } else if (bidAmount === currentHighestMaxPrice) {
          // Tie - previous bidder wins (first-come-first-served)
          newCurrentPrice = bidAmount;
          newHighestBidderId = currentHighestBidderId;
          newHighestMaxPrice = currentHighestMaxPrice;
        } else {
          // New bidder wins
          newCurrentPrice = currentHighestMaxPrice + minIncrement;
          newHighestBidderId = userId;
          newHighestMaxPrice = bidAmount;
        }
      }

      // Check if buy_now price reached after auto-bidding
      if (buyNowPrice && newCurrentPrice >= buyNowPrice) {
        newCurrentPrice = buyNowPrice;
        buyNowTriggered = true;
      }
    }

    const productSold = buyNowTriggered;

    // === UPDATE DATABASE ===

    // Update product
    const updateData = {
      current_price: newCurrentPrice,
      highest_bidder_id: newHighestBidderId,
      highest_max_price: newHighestMaxPrice
    };

    if (productSold) {
      updateData.end_at = new Date();
      updateData.closed_at = new Date();
      // is_sold remains NULL → PENDING status
    } else if (extendedEndTime) {
      updateData.end_at = extendedEndTime;
    }

    await trx('products')
      .where('id', productId)
      .update(updateData);

    // Add bidding history (only if price changed)
    if (shouldCreateHistory) {
      await trx('bidding_history').insert({
        product_id: productId,
        bidder_id: newHighestBidderId,
        current_price: newCurrentPrice
      });
    }

    // Update auto_bidding table (upsert)
    await trx.raw(`
      INSERT INTO auto_bidding (product_id, bidder_id, max_price)
      VALUES (?, ?, ?)
      ON CONFLICT (product_id, bidder_id)
      DO UPDATE SET 
        max_price = EXCLUDED.max_price,
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

  // === SEND EMAIL NOTIFICATIONS (outside transaction) ===

  await sendBidNotifications({
    sellerId: result.sellerId,
    currentBidderId: result.userId,
    previousBidderId: result.previousHighestBidderId,
    productId,
    productName: result.productName,
    newCurrentPrice: result.newCurrentPrice,
    previousPrice: result.previousPrice,
    bidAmount: result.bidAmount,
    productSold: result.productSold,
    priceChanged: result.priceChanged,
    productUrl
  });

  return result;
}
