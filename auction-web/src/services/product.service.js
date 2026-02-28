import * as productModel from "../models/product.model.js";
import * as productDescUpdateModel from "../models/productDescriptionUpdate.model.js";
import * as categoryModel from "../models/category.model.js";
import * as systemSettingModel from "../models/systemSetting.model.js";
import { formatAddProduct } from "../utils/product-formatter.js";
import * as fileService from "./file.service.js";
import {
  calculatePagination,
  calculateOffset,
  parsePageNumber,
} from "../utils/pagination.js";

export async function createProduct(product, sellerId) {
  const productData = formatAddProduct(product, sellerId);
  const returnedID = await productModel.addProduct(productData);
  const newProductId = returnedID[0].id;

  // Handle thumbnail upload and update product record
  if (product.thumbnail) {
    const savedThumbPath = fileService.moveAndRenameThumbnail(
      newProductId,
      product.thumbnail,
    );
    await productModel.updateProductThumbnail(newProductId, savedThumbPath);
  }

  // Handle sub-images upload and update product record
  if (product.sub_images) {
    const newImgPaths = fileService.moveAndRenameSubImages(
      newProductId,
      product.imgs_list,
    );
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
    throw new Error("PRODUCT_NOT_FOUND");
  }
  if (product.seller_id !== sellerId) {
    throw new Error("UNAUTHORIZED");
  }

  // Update product description and log the update
  await productDescUpdateModel.addUpdate(productId, description);

  // Return the updated product details (including the new description)
  return product;
}

/**
 * Product Listing & Search Service Functions
 * Encapsulates business logic for product browsing operations.
 */

/**
 * Determines if a product is "new" based on system settings.
 * @param {Object} product - Product object
 * @param {number} newProductLimitMinutes - Limit in minutes from settings
 * @returns {boolean} True if product is new
 */
function isProductNew(product, newProductLimitMinutes) {
  const now = new Date();
  const created = new Date(product.created_at);
  return now - created < newProductLimitMinutes * 60 * 1000;
}

/**
 * Prepares product list by adding "is_new" flag based on system settings.
 * @param {Array} products - Array of products
 * @returns {Promise<Array>} Products with is_new flag
 */
export async function prepareProductList(products) {
  if (!products || products.length === 0) return [];

  // Load settings from database to get latest value
  const settings = await systemSettingModel.getSettings();
  const N_MINUTES = settings.new_product_limit_minutes;

  return products.map((product) => ({
    ...product,
    is_new: isProductNew(product, N_MINUTES),
  }));
}

/**
 * Gets products by category with pagination and sorting.
 * Handles both parent and child categories.
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Products and pagination data
 */
export async function getProductsByCategory(params) {
  const { categoryId, page = 1, limit = 3, sort = "", userId = null } = params;

  const pageNum = parsePageNumber(page);
  const offset = calculateOffset(pageNum, limit);

  // Get category information
  const category = await categoryModel.findByCategoryId(categoryId);
  if (!category) {
    throw new Error("Category not found");
  }

  // Include child categories if this is a level 1 category
  let categoryIds = [categoryId];
  if (category.parent_id === null) {
    const childCategories =
      await categoryModel.findChildCategoryIds(categoryId);
    const childIds = childCategories.map((cat) => cat.id);
    categoryIds = [categoryId, ...childIds];
  }

  // Fetch products and count in parallel
  const [list, total] = await Promise.all([
    productModel.findByCategoryIds(categoryIds, limit, offset, sort, userId),
    productModel.countByCategoryIds(categoryIds),
  ]);

  const products = await prepareProductList(list);
  const totalCount = parseInt(total.count) || 0;
  const pagination = calculatePagination(pageNum, limit, totalCount);

  return {
    products,
    ...pagination,
    categoryId,
    categoryName: category.name,
    sort,
  };
}

/**
 * Searches products by keywords with pagination and sorting.
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Products and pagination data
 */
export async function searchProducts(params) {
  const {
    q = "",
    logic = "and",
    sort = "",
    page = 1,
    limit = 3,
    userId = null,
  } = params;

  // If keyword is empty, return empty results
  if (q.trim().length === 0) {
    return {
      products: [],
      totalCount: 0,
      from: 0,
      to: 0,
      currentPage: 1,
      totalPages: 0,
      q,
      logic,
      sort,
    };
  }

  const pageNum = parsePageNumber(page);
  const offset = calculateOffset(pageNum, limit);
  const keywords = q.trim();

  // Search in both product name and category
  const [list, total] = await Promise.all([
    productModel.searchPageByKeywords(
      keywords,
      limit,
      offset,
      userId,
      logic,
      sort,
    ),
    productModel.countByKeywords(keywords, logic),
  ]);

  const products = await prepareProductList(list);
  const totalCount = parseInt(total.count) || 0;
  const pagination = calculatePagination(pageNum, limit, totalCount);

  return {
    products,
    ...pagination,
    q,
    logic,
    sort,
  };
}

/**
 * Gets detailed product information.
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} Product details
 */
export async function getProductDetail(params) {
  const { productId, userId = null } = params;

  const product = await productModel.findByProductId2(productId, userId);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  return product;
}

/**
 * Gets related products for a given product.
 * @param {number} productId - Product ID
 * @returns {Promise<Array>} Related products
 */
export async function getRelatedProducts(productId) {
  return await productModel.findRelatedProducts(productId);
}
