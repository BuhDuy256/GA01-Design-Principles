/**
 * Product Authorization Utility
 * Provides reusable validation and authorization functions for product operations
 */

function ensureProductExists(product, options = { throwError: true }) {
  if (!product) {
    if (options.throwError) {
      throw new Error('Product not found');
    }
    return { status: 404, message: 'Product not found' };
  }
  return null;
}

function ensureSellerOwnership(product, userId, action = 'perform this action') {
  if (product.seller_id !== userId) {
    throw new Error(`Only the seller can ${action}`);
  }
}

function ensureProductIsActive(product, operation = 'perform this operation') {
  const now = new Date();
  const endDate = new Date(product.end_at);

  if (product.is_sold !== null || endDate <= now || product.closed_at) {
    throw new Error(`Can only ${operation} for active auctions`);
  }
}

function ensureNotSeller(product, userId, action = 'perform this action on their own product') {
  if (product.seller_id === userId) {
    throw new Error(`Seller cannot ${action}`);
  }
}

function ensureCanViewProduct(product, userId, productStatus) {
  // ACTIVE products can be viewed by anyone
  if (productStatus === 'ACTIVE') {
    return null;
  }

  // Non-ACTIVE products require authentication
  if (!userId) {
    return {
      status: 403,
      message: 'You do not have permission to view this product'
    };
  }

  // Check if user is seller or highest bidder
  const isSeller = product.seller_id === userId;
  const isHighestBidder = product.highest_bidder_id === userId;

  if (!isSeller && !isHighestBidder) {
    return {
      status: 403,
      message: 'You do not have permission to view this product'
    };
  }

  return null;
}

export {
  ensureProductExists,
  ensureSellerOwnership,
  ensureCanViewProduct,
  ensureProductIsActive,
  ensureNotSeller
};
