import * as productModel from "../models/product.model.js";

/**
 * Home Service
 * Encapsulates business logic for home page operations.
 * Follows Single Responsibility Principle by separating business logic from HTTP handling.
 */

/**
 * Retrieves all featured product collections for the home page.
 * Uses Promise.all for optimal performance.
 * @returns {Promise<Object>} Object containing topEnding, topBids, and topPrice products
 */
export async function getFeaturedProducts() {
  try {
    const [topEnding, topBids, topPrice] = await Promise.all([
      productModel.findTopEnding(),
      productModel.findTopBids(),
      productModel.findTopPrice(),
    ]);

    return {
      topEndingProducts: topEnding,
      topBidsProducts: topBids,
      topPriceProducts: topPrice,
    };
  } catch (error) {
    console.error("Error fetching featured products:", error);
    throw new Error("Failed to load featured products");
  }
}
