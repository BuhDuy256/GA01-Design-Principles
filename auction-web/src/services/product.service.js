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
 * Get complete product details with all related data
 * @param {Object} params - Request parameters
 * @returns {Promise<Object>} Complete product details
 */
export async function getProductDetail({ productId, userId = null, commentPage = 1, commentsPerPage = 2 }) {
  const product = await productModel.findByProductId2(productId, userId);

  if (!product) {
    const error = new Error('Product not found');
    error.code = 'PRODUCT_NOT_FOUND';
    throw error;
  }

  const related_products = await productModel.findRelatedProducts(productId);

  // Determine product status
  const now = new Date();
  const endDate = new Date(product.end_at);

  // Auto-close auction if time expired and not yet closed
  if (endDate <= now && !product.closed_at && product.is_sold === null) {
    await productModel.updateProduct(productId, { closed_at: endDate });
    product.closed_at = endDate;
  }

  const productStatus = determineProductStatus(product);

  // Pagination for comments
  const offset = (commentPage - 1) * commentsPerPage;

  // Load description updates, bidding history, and comments in parallel
  const [descriptionUpdates, biddingHistory, comments, totalComments] = await Promise.all([
    productDescUpdateModel.findByProductId(productId),
    biddingHistoryModel.getBiddingHistory(productId),
    productCommentModel.getCommentsByProductId(productId, commentsPerPage, offset),
    productCommentModel.countCommentsByProductId(productId)
  ]);

  // Load rejected bidders (only for seller - will be filtered in route)
  const rejectedBidders = await rejectedBidderModel.getRejectedBidders(productId);

  // Load replies for all comments in one batch to avoid N+1 query problem
  if (comments.length > 0) {
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

  // Calculate total pages
  const totalPages = Math.ceil(totalComments / commentsPerPage);

  // Get seller rating
  const sellerRatingSummary = await getUserRatingSummary(product.seller_id);

  // Get bidder rating (if exists)
  let bidderRatingSummary = { rating_point: null, reviews: [] };
  if (product.highest_bidder_id) {
    bidderRatingSummary = await getUserRatingSummary(product.highest_bidder_id);
  }

  return {
    product,
    productStatus,
    descriptionUpdates,
    biddingHistory,
    rejectedBidders,
    comments,
    totalComments,
    totalPages,
    related_products,
    sellerRatingSummary,
    bidderRatingSummary
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
