import * as productModel from '../models/product.model.js'
import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
import * as rejectedBidderModel from '../models/rejectedBidder.model.js';
import * as categoryModel from '../models/category.model.js';
import * as systemSettingModel from '../models/systemSetting.model.js';
import { getUserRatingSummary } from './rating.service.js';
import { formatAddProduct } from '../utils/product-formatter.js';
import * as fileService from './file.service.js';

export async function createProduct(product, sellerId) {
  const productData = formatAddProduct(product, sellerId);
  const returnedID = await productModel.addProduct(productData);
  const newProductId = returnedID[0].id;

  // Handle thumbnail upload and update product record
  if (product.thumbnail) {
    const savedThumbPath = fileService.moveAndRenameThumbnail(newProductId, product.thumbnail);
    await productModel.updateProductThumbnail(newProductId, savedThumbPath);
  }

  // Handle sub-images upload and update product record
  if (product.sub_images) {
    const newImgPaths = fileService.moveAndRenameSubImages(newProductId, product.imgs_list);
    if (newImgPaths.length > 0) {
      await productModel.addProductImages(newImgPaths);
    }
  }
  return newProductId;
}

export async function appendDescription(productId, sellerId, description) {
  // Check if product exists and belongs to the seller
  const product = await productModel.findByProductId2(productId, null);
  if (!product) {
    throw new Error('PRODUCT_NOT_FOUND');
  }
  if (product.seller_id !== sellerId) {
    throw new Error('UNAUTHORIZED');
  }

  // Update product description and log the update
  await productDescUpdateModel.addUpdate(productId, description);

  // Return the updated product details (including the new description)
  return product;
}

/**
 * Prepare product list with "is_new" flag based on creation time
 * @param {Array} products - List of products
 * @returns {Promise<Array>} Products with is_new flag
 */
async function prepareProductList(products) {
  const now = new Date();
  if (!products) return [];

  // Load settings from database every time to get latest value
  const settings = await systemSettingModel.getSettings();
  const N_MINUTES = settings.new_product_limit_minutes;

  return products.map(product => {
    const created = new Date(product.created_at);
    const isNew = (now - created) < (N_MINUTES * 60 * 1000);

    return {
      ...product,
      is_new: isNew
    };
  });
}

/**
 * Get products by category with pagination
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Products list and pagination data
 */
export async function getProductsByCategory({ categoryId, page = 1, sort = '', userId = null, limit = 3 }) {
  const offset = (page - 1) * limit;

  // Check if category is level 1 (parent_id is null)
  const category = await categoryModel.findByCategoryId(categoryId);

  let categoryIds = [categoryId];

  // If it's a level 1 category, include all child categories
  if (category && category.parent_id === null) {
    const childCategories = await categoryModel.findChildCategoryIds(categoryId);
    const childIds = childCategories.map(cat => cat.id);
    categoryIds = [categoryId, ...childIds];
  }

  const list = await productModel.findByCategoryIds(categoryIds, limit, offset, sort, userId);
  const products = await prepareProductList(list);
  const total = await productModel.countByCategoryIds(categoryIds);

  return {
    products,
    total: total.count,
    category
  };
}

/**
 * Search products by keywords with pagination
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} Search results and pagination data
 */
export async function searchProducts({ keywords, page = 1, logic = 'and', sort = '', userId = null, limit = 3 }) {
  // If keyword is empty, return empty results
  if (!keywords || keywords.length === 0) {
    return {
      products: [],
      total: 0
    };
  }

  const offset = (page - 1) * limit;
  const trimmedKeywords = keywords.trim();

  // Search in both product name and category
  const list = await productModel.searchPageByKeywords(trimmedKeywords, limit, offset, userId, logic, sort);
  const products = await prepareProductList(list);
  const total = await productModel.countByKeywords(trimmedKeywords, logic);

  return {
    products,
    total: total.count
  };
}

/**
 * Product status determination rules (OCP Compliant - Open for Extension, Closed for Modification)
 * To add a new status, simply add a new rule to this array without modifying the determineProductStatus function
 * 
 * Each rule contains:
 * - status: The status string to return
 * - matches: A predicate function that returns true if the rule applies
 */
const PRODUCT_STATUS_RULES = [
  {
    status: 'SOLD',
    matches: (product, now, endDate) => product.is_sold === true
  },
  {
    status: 'CANCELLED',
    matches: (product, now, endDate) => product.is_sold === false
  },
  {
    status: 'PENDING',
    matches: (product, now, endDate) =>
      (endDate <= now || product.closed_at) && product.highest_bidder_id
  },
  {
    status: 'EXPIRED',
    matches: (product, now, endDate) =>
      endDate <= now && !product.highest_bidder_id
  },
  {
    status: 'ACTIVE',
    matches: (product, now, endDate) =>
      endDate > now && !product.closed_at
  }
];

/**
 * Determine product status based on current state
 * This function is closed for modification - new statuses are added to PRODUCT_STATUS_RULES array
 * 
 * @param {Object} product - Product object
 * @returns {string} Product status (ACTIVE, SOLD, CANCELLED, PENDING, EXPIRED)
 */
export function determineProductStatus(product) {
  const now = new Date();
  const endDate = new Date(product.end_at);

  // Find the first matching rule
  const matchedRule = PRODUCT_STATUS_RULES.find(rule =>
    rule.matches(product, now, endDate)
  );

  // Return matched status or default to ACTIVE
  return matchedRule ? matchedRule.status : 'ACTIVE';
}

/**
 * Check if product is in ACTIVE status (DRY: reuses determineProductStatus)
 * 
 * @param {Object} product - Product object
 * @returns {boolean} True if product is ACTIVE
 */
export function isProductActive(product) {
  return determineProductStatus(product) === 'ACTIVE';
}

/**
 * Auto-close expired auction (KISS: Single responsibility)
 */
async function autoCloseExpiredAuction(product, productId) {
  const now = new Date();
  const endDate = new Date(product.end_at);

  if (endDate <= now && !product.closed_at && product.is_sold === null) {
    await productModel.updateProduct(productId, { closed_at: endDate });
    product.closed_at = endDate;
  }
}

/**
 * Load product-related data in parallel (KISS: Single responsibility)
 */
async function loadProductRelatedData(productId, commentsPerPage, offset) {
  const [descriptionUpdates, biddingHistory, comments, totalComments, rejectedBidders, relatedProducts] =
    await Promise.all([
      productDescUpdateModel.findByProductId(productId),
      biddingHistoryModel.getBiddingHistory(productId),
      productCommentModel.getCommentsByProductId(productId, commentsPerPage, offset),
      productCommentModel.countCommentsByProductId(productId),
      rejectedBidderModel.getRejectedBidders(productId),
      productModel.findRelatedProducts(productId)
    ]);

  return {
    descriptionUpdates,
    biddingHistory,
    comments,
    totalComments,
    rejectedBidders,
    relatedProducts
  };
}

/**
 * Enrich comments with their replies (KISS: Single responsibility)
 * Loads all replies in one batch to avoid N+1 queries
 */
async function enrichCommentsWithReplies(comments) {
  if (comments.length === 0) {
    return;
  }

  const commentIds = comments.map(c => c.id);
  const allReplies = await productCommentModel.getRepliesByCommentIds(commentIds);

  // Group replies by parent comment id
  const repliesMap = new Map();
  for (const reply of allReplies) {
    if (!repliesMap.has(reply.parent_id)) {
      repliesMap.set(reply.parent_id, []);
    }
    repliesMap.get(reply.parent_id).push(reply);
  }

  // Attach replies to their parent comments
  for (const comment of comments) {
    comment.replies = repliesMap.get(comment.id) || [];
  }
}

/**
 * Load rating summaries for seller and bidder (KISS: Single responsibility)
 */
async function loadRatingSummaries(sellerId, bidderId) {
  const sellerRatingSummary = await getUserRatingSummary(sellerId);

  let bidderRatingSummary = { rating_point: null, reviews: [] };
  if (bidderId) {
    bidderRatingSummary = await getUserRatingSummary(bidderId);
  }

  return { sellerRatingSummary, bidderRatingSummary };
}

/**
 * Get complete product details with all related data
 * (KISS: Orchestration only - delegates to focused helper functions)
 * 
 * @param {Object} params - Request parameters
 * @returns {Promise<Object>} Complete product details
 */
export async function getProductDetail({ productId, userId = null, commentPage = 1, commentsPerPage = 2 }) {
  // 1. Load and validate product
  const product = await productModel.findByProductId2(productId, userId);
  if (!product) {
    const error = new Error('Product not found');
    error.code = 'PRODUCT_NOT_FOUND';
    throw error;
  }

  // 2. Auto-close if expired
  await autoCloseExpiredAuction(product, productId);

  // 3. Determine status
  const productStatus = determineProductStatus(product);

  // 4. Load all related data
  const offset = (commentPage - 1) * commentsPerPage;
  const relatedData = await loadProductRelatedData(productId, commentsPerPage, offset);

  // 5. Enrich comments with replies
  await enrichCommentsWithReplies(relatedData.comments);

  // 6. Load rating summaries
  const ratings = await loadRatingSummaries(product.seller_id, product.highest_bidder_id);

  // 7. Return complete product details
  return {
    product,
    productStatus,
    descriptionUpdates: relatedData.descriptionUpdates,
    biddingHistory: relatedData.biddingHistory,
    rejectedBidders: relatedData.rejectedBidders,
    comments: relatedData.comments,
    totalComments: relatedData.totalComments,
    totalPages: Math.ceil(relatedData.totalComments / commentsPerPage),
    related_products: relatedData.relatedProducts,
    sellerRatingSummary: ratings.sellerRatingSummary,
    bidderRatingSummary: ratings.bidderRatingSummary
  };
}

/**
 * Get bidding history for a product (for bidding history page)
 * @param {number} productId - Product ID
 * @returns {Promise<Object>} Product and bidding history
 */
export async function getBiddingHistoryPage(productId) {
  const product = await productModel.findByProductId2(productId, null);

  if (!product) {
    const error = new Error('Product not found');
    error.code = 'PRODUCT_NOT_FOUND';
    throw error;
  }

  const biddingHistory = await biddingHistoryModel.getBiddingHistory(productId);

  return {
    product,
    biddingHistory
  };
}

/**
 * Unreject a bidder from a product
 * @param {Object} params - Parameters
 * @returns {Promise<void>}
 */
export async function unrejectBidder({ productId, bidderId, sellerId }) {
  // Verify product ownership
  const product = await productModel.findByProductId2(productId, sellerId);

  if (!product) {
    throw new Error('Product not found');
  }

  if (product.seller_id !== sellerId) {
    throw new Error('You do not own this product');
  }

  // Check product is still active (DRY: reuses isProductActive)
  if (!isProductActive(product)) {
    throw new Error('Cannot unreject bidders on inactive products');
  }

  // Remove from rejected_bidders table
  await rejectedBidderModel.unrejectBidder(productId, bidderId);
}


// Seller dashboard and product listing
export async function getSellerStats(sellerId) {
    return await productModel.getSellerStats(sellerId);
}

export async function findAllProductsBySellerId(sellerId) {
    return await productModel.findAllProductsBySellerId(sellerId);
}

export async function findActiveProductsBySellerId(sellerId) {
    return await productModel.findActiveProductsBySellerId(sellerId);
}

export async function findPendingProductsBySellerId(sellerId) {
    return await productModel.findPendingProductsBySellerId(sellerId);
}

export async function getPendingProductsStats(sellerId) {
    return await productModel.getPendingProductsStats(sellerId);
}

export async function findSoldProductsBySellerId(sellerId) {
    return await productModel.findSoldProductsBySellerId(sellerId);
}

export async function getSoldProductsStats(sellerId) {
    return await productModel.getSoldProductsStats(sellerId);
}

export async function findExpiredProductsBySellerId(sellerId) {
    return await productModel.findExpiredProductsBySellerId(sellerId);
}

// Product cancellation
export async function cancelProduct(productId, sellerId) {
    return await productModel.cancelProduct(productId, sellerId);
}

// Verify product ownership helper
async function verifyProductOwnership(productId, sellerId) {
    const product = await productModel.findByProductId2(productId, null);
    if (!product) {
        const error = new Error('Product not found');
        error.code = 'PRODUCT_NOT_FOUND';
        throw error;
    }
    if (product.seller_id !== sellerId) {
        const error = new Error('Unauthorized');
        error.code = 'UNAUTHORIZED';
        throw error;
    }
    return product;
}

// Description updates management
export async function getDescriptionUpdates(productId, sellerId) {
    await verifyProductOwnership(productId, sellerId);
    return await productDescUpdateModel.findByProductId(productId);
}

export async function updateDescriptionUpdate(updateId, sellerId, content) {
    const update = await productDescUpdateModel.findById(updateId);
    if (!update) {
        const error = new Error('Update not found');
        error.code = 'UPDATE_NOT_FOUND';
        throw error;
    }
    
    await verifyProductOwnership(update.product_id, sellerId);
    await productDescUpdateModel.updateContent(updateId, content);
}

export async function deleteDescriptionUpdate(updateId, sellerId) {
    const update = await productDescUpdateModel.findById(updateId);
    if (!update) {
        const error = new Error('Update not found');
        error.code = 'UPDATE_NOT_FOUND';
        throw error;
    }
    
    await verifyProductOwnership(update.product_id, sellerId);
    await productDescUpdateModel.deleteUpdate(updateId);
}