/**
 * bid-engine.js
 *
 * Pure domain logic for the automatic bidding algorithm.
 * Zero infrastructure dependencies — no DB, no HTTP, no side effects.
 * Every function is a deterministic transformation of its inputs.
 *
 * This module is the single source of truth for:
 *   - Bid eligibility rules
 *   - Amount / increment validation
 *   - Auto-extend computation
 *   - Auto-bid (proxy bidding) resolution algorithm
 *   - Response message construction
 *
 * Related issues: #4 (KISS — oversized handler), #5 (OCP — inline algorithm),
 *                 #8 (DIP — route depends on concrete infrastructure)
 */

// ---------------------------------------------------------------------------
// Eligibility Validation
// ---------------------------------------------------------------------------

/**
 * Validate whether a user is eligible to bid on a product.
 *
 * @param {object} params
 * @param {object} params.product        - Product row (pre-fetched from DB)
 * @param {number} params.userId         - Bidder's user ID
 * @param {number|null} params.ratingPoint  - Pre-computed rating (null = no reviews)
 * @param {boolean}     params.hasReviews   - Whether user has any review history
 * @param {boolean}     params.isRejected   - Whether bidder is on the rejected list
 * @param {Date}        params.now          - Current timestamp (injected for testability)
 *
 * @returns {{ eligible: boolean, reason?: string }}
 */
export function validateBidEligibility({ product, userId, ratingPoint, hasReviews, isRejected, now }) {
  if (product.is_sold === true) {
    return { eligible: false, reason: 'This product has already been sold' };
  }
  if (product.seller_id === userId) {
    return { eligible: false, reason: 'You cannot bid on your own product' };
  }
  if (isRejected) {
    return { eligible: false, reason: 'You have been rejected from bidding on this product by the seller' };
  }
  if (!hasReviews && !product.allow_unrated_bidder) {
    return { eligible: false, reason: 'This seller does not allow unrated bidders to bid on this product.' };
  }
  if (hasReviews && ratingPoint !== null && ratingPoint <= 0) {
    return { eligible: false, reason: 'You are not eligible to place bids due to your rating.' };
  }
  if (hasReviews && ratingPoint !== null && ratingPoint <= 0.8) {
    return { eligible: false, reason: 'Your rating point is not greater than 80%. You cannot place bids.' };
  }
  if (now > new Date(product.end_at)) {
    return { eligible: false, reason: 'Auction has ended' };
  }
  return { eligible: true };
}

/**
 * Validate whether a user is eligible to use Buy Now on a product.
 *
 * @param {object} params
 * @param {object}  params.product      - Product row (pre-fetched)
 * @param {number}  params.userId       - Buyer's user ID
 * @param {boolean} params.isRejected   - Whether buyer is on the rejected list
 * @param {number}  params.ratingPoint  - Buyer's rating point (0 = unrated)
 * @param {Date}    params.now          - Current timestamp
 *
 * @returns {{ eligible: boolean, reason?: string }}
 */
export function validateBuyNowEligibility({ product, userId, isRejected, ratingPoint, now }) {
  if (product.is_sold !== null) {
    return { eligible: false, reason: 'Product is no longer available' };
  }
  if (product.seller_id === userId) {
    return { eligible: false, reason: 'Seller cannot buy their own product' };
  }
  const endDate = new Date(product.end_at);
  if (endDate <= now || product.closed_at) {
    return { eligible: false, reason: 'Auction has already ended' };
  }
  if (!product.buy_now_price) {
    return { eligible: false, reason: 'Buy Now option is not available for this product' };
  }
  if (isRejected) {
    return { eligible: false, reason: 'You have been rejected from bidding on this product' };
  }
  if (!product.allow_unrated_bidder && ratingPoint === 0) {
    return { eligible: false, reason: 'This product does not allow bidders without ratings' };
  }
  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Amount / Increment Validation
// ---------------------------------------------------------------------------

/**
 * Validate the bid amount against the current price and minimum increment.
 *
 * @param {number} currentPrice - Current product price
 * @param {number} bidAmount    - Amount the user wants to bid
 * @param {number} stepPrice    - Minimum bid increment
 *
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateBidAmount(currentPrice, bidAmount, stepPrice) {
  if (bidAmount <= currentPrice) {
    return {
      valid: false,
      reason: `Bid must be higher than current price (${currentPrice.toLocaleString()} VND)`
    };
  }
  if (bidAmount < currentPrice + stepPrice) {
    return {
      valid: false,
      reason: `Bid must be at least ${stepPrice.toLocaleString()} VND higher than current price`
    };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Auto-Extend Computation
// ---------------------------------------------------------------------------

/**
 * Determine whether a bid triggers an auction time extension.
 * Returns the new end time if an extension applies, null otherwise.
 *
 * @param {object} product  - Product row (must have end_at, auto_extend)
 * @param {Date}   now      - Current timestamp
 * @param {object} settings - System settings ({ auto_extend_trigger_minutes, auto_extend_duration_minutes })
 *
 * @returns {Date|null}
 */
export function computeAutoExtend(product, now, settings) {
  if (!product.auto_extend) return null;

  const endTime = new Date(product.end_at);
  const minutesRemaining = (endTime - now) / (1000 * 60);

  if (minutesRemaining <= settings.auto_extend_trigger_minutes) {
    return new Date(endTime.getTime() + settings.auto_extend_duration_minutes * 60 * 1000);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auto-Bid (Proxy Bidding) Resolution
// ---------------------------------------------------------------------------

/**
 * Compute the outcome of placing a bid using the proxy (auto) bidding algorithm.
 *
 * Invariants this function enforces:
 *   - Existing highest bidder always wins ties (first-come-first-served)
 *   - If existing max >= buy_now_price and a NEW bidder arrives, existing bidder
 *     wins immediately at buy_now_price (buy-now protection rule)
 *   - When the same user is already the highest bidder, only their max price
 *     is updated; current_price and history remain unchanged
 *
 * @param {object} params
 * @param {object} params.product      - Product row (current state before this bid)
 * @param {number} params.userId       - Bidder ID
 * @param {number} params.bidAmount    - User's maximum bid
 * @param {number} params.minIncrement - Minimum bid step (product.step_price)
 * @param {number|null} params.buyNowPrice - Buy-now price (null if not set)
 *
 * @returns {{
 *   newCurrentPrice:    number,
 *   newHighestBidderId: number,
 *   newHighestMaxPrice: number,
 *   shouldCreateHistory: boolean,
 *   buyNowTriggered:    boolean
 * }}
 */
export function computeAutoBidResult({ product, userId, bidAmount, minIncrement, buyNowPrice }) {
  // --- Buy-now protection: existing highest bidder already committed >= buy_now ---
  if (
    buyNowPrice &&
    product.highest_bidder_id &&
    product.highest_max_price &&
    product.highest_bidder_id !== userId
  ) {
    const existingMax = parseFloat(product.highest_max_price);
    if (existingMax >= buyNowPrice) {
      return {
        newCurrentPrice: buyNowPrice,
        newHighestBidderId: product.highest_bidder_id,
        newHighestMaxPrice: existingMax,
        shouldCreateHistory: true,
        buyNowTriggered: true
      };
    }
  }

  // --- Case 0: same user is already the highest bidder — update max price only ---
  if (product.highest_bidder_id === userId) {
    return {
      newCurrentPrice: parseFloat(product.current_price || product.starting_price),
      newHighestBidderId: userId,
      newHighestMaxPrice: bidAmount,
      shouldCreateHistory: false,
      buyNowTriggered: false
    };
  }

  let newCurrentPrice;
  let newHighestBidderId;
  let newHighestMaxPrice;

  // --- Case 1: first bid on this product ---
  if (!product.highest_bidder_id || !product.highest_max_price) {
    newCurrentPrice = parseFloat(product.starting_price);
    newHighestBidderId = userId;
    newHighestMaxPrice = bidAmount;
  } else {
    // --- Case 2: competing against an existing highest bidder ---
    const existingMax = parseFloat(product.highest_max_price);

    if (bidAmount < existingMax) {
      // 2a: new bid < existing max → existing bidder defends, price = new bid
      newCurrentPrice = bidAmount;
      newHighestBidderId = product.highest_bidder_id;
      newHighestMaxPrice = existingMax;
    } else if (bidAmount === existingMax) {
      // 2b: tie → existing bidder wins (first-come-first-served)
      newCurrentPrice = bidAmount;
      newHighestBidderId = product.highest_bidder_id;
      newHighestMaxPrice = existingMax;
    } else {
      // 2c: new bid > existing max → new bidder wins, price = existingMax + step
      newCurrentPrice = existingMax + minIncrement;
      newHighestBidderId = userId;
      newHighestMaxPrice = bidAmount;
    }
  }

  // --- Post-computation: buy-now price check ---
  let buyNowTriggered = false;
  if (buyNowPrice && newCurrentPrice >= buyNowPrice) {
    newCurrentPrice = buyNowPrice;
    buyNowTriggered = true;
  }

  return {
    newCurrentPrice,
    newHighestBidderId,
    newHighestMaxPrice,
    shouldCreateHistory: true,
    buyNowTriggered
  };
}

// ---------------------------------------------------------------------------
// Response Message Builder
// ---------------------------------------------------------------------------

/**
 * Build the flash message shown to the user after a bid is placed.
 *
 * @param {object} result - Result object returned by placeBid()
 *
 * @returns {string}
 */
export function buildBidResponseMessage(result) {
  let message;

  if (result.productSold) {
    if (result.newHighestBidderId === result.userId) {
      message = `Congratulations! You won the product with Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Please proceed to payment.`;
    } else {
      message = `Product has been sold to another bidder at Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Your bid helped reach the Buy Now threshold.`;
    }
  } else if (result.newHighestBidderId === result.userId) {
    message = `Bid placed successfully! Current price: ${result.newCurrentPrice.toLocaleString()} VND (Your max: ${result.bidAmount.toLocaleString()} VND)`;
  } else {
    message = `Bid placed! Another bidder is currently winning at ${result.newCurrentPrice.toLocaleString()} VND`;
  }

  if (result.autoExtended) {
    const extendedTimeStr = new Date(result.newEndTime).toLocaleString('vi-VN');
    message += ` | Auction extended to ${extendedTimeStr}`;
  }

  return message;
}
