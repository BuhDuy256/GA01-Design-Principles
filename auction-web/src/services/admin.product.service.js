import db from "../utils/db.js";
import path from "path";
import fs from "fs";
import * as productModel from "../models/product.model.js";

/**
 * Admin Product Service
 * Encapsulates business logic for admin product management operations.
 * Follows Single Responsibility Principle by separating business logic from HTTP handling.
 */

/**
 * Retrieves all products with formatted data for list view.
 * @returns {Promise<Array>} List of products with essential fields
 */
export async function getAllProducts() {
  const products = await productModel.findAll();
  // Transform data for display - only include necessary fields
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    seller_name: p.seller_name,
    current_price: p.current_price,
    highest_bidder_name: p.highest_bidder_name,
  }));
}

/**
 * Retrieves product details by ID for admin view.
 * @param {number} productId - The product ID
 * @returns {Promise<Object|null>} Product details or null if not found
 */
export async function getProductById(productId) {
  return await productModel.findByProductIdForAdmin(productId);
}

/**
 * Transforms raw form data into structured product data.
 * Handles price formatting and data conversion.
 * @param {Object} formData - Raw form data from request body
 * @returns {Object} Structured product data ready for database insertion
 */
export function transformProductFormData(formData) {
  return {
    seller_id: formData.seller_id,
    category_id: formData.category_id,
    name: formData.name,
    starting_price: formData.start_price.replace(/,/g, ""),
    step_price: formData.step_price.replace(/,/g, ""),
    buy_now_price:
      formData.buy_now_price !== ""
        ? formData.buy_now_price.replace(/,/g, "")
        : null,
    created_at: formData.created_at,
    end_at: formData.end_date,
    auto_extend: formData.auto_extend === "1",
    thumbnail: null, // to be updated after upload
    description: formData.description,
    highest_bidder_id: null,
    current_price: formData.start_price.replace(/,/g, ""),
    is_sold: null,
    closed_at: null,
    allow_unrated_bidder: formData.allow_new_bidders === "1",
  };
}

/**
 * Creates a new product, physically moves/renames the uploaded images,
 * and inserts image records into the database within a single transaction.
 * Ensures that if any step fails (e.g. file system error or DB error),
 * the entire database operation is rolled back.
 * @param {Object} productData - Product data to insert
 * @param {string} thumbnailFile - Thumbnail file path
 * @param {Array<string>} subImageFiles - Array of sub-image file paths
 * @returns {Promise<number>} The created product ID
 */
export async function createProductWithImages(
  productData,
  thumbnailFile,
  subImageFiles,
) {
  const returnedID = await db.transaction(async (trx) => {
    // 1. Insert the main product record
    const [insertedProduct] = await trx("products")
      .insert(productData)
      .returning("id");
    const productId = insertedProduct.id || insertedProduct; // Handle different DB dialects

    const dirPath = path
      .join("public", "images", "products")
      .replace(/\\/g, "/");

    // 2. Move and rename the main thumbnail
    if (thumbnailFile) {
      const mainPath = path
        .join(dirPath, `p${productId}_thumb.jpg`)
        .replace(/\\/g, "/");
      const oldMainPath = path
        .join("public", "uploads", path.basename(thumbnailFile))
        .replace(/\\/g, "/");
      const savedMainPath =
        "/" +
        path
          .join("images", "products", `p${productId}_thumb.jpg`)
          .replace(/\\/g, "/");

      // Physical file move
      fs.renameSync(oldMainPath, mainPath);

      // Update DB with the final permanent path
      await trx("products")
        .where("id", productId)
        .update({ thumbnail: savedMainPath });
    }

    // 3. Move and rename the sub-images and insert their records
    if (subImageFiles && subImageFiles.length > 0) {
      let i = 1;
      let newImgPaths = [];
      for (const imgPath of subImageFiles) {
        const oldPath = path
          .join("public", "uploads", path.basename(imgPath))
          .replace(/\\/g, "/");
        const newPath = path
          .join(dirPath, `p${productId}_${i}.jpg`)
          .replace(/\\/g, "/");
        const savedPath =
          "/" +
          path
            .join("images", "products", `p${productId}_${i}.jpg`)
            .replace(/\\/g, "/");

        // Physical file move
        fs.renameSync(oldPath, newPath);

        newImgPaths.push({
          product_id: productId,
          img_link: savedPath,
        });
        i++;
      }

      // Insert sub images mapping to DB
      if (newImgPaths.length > 0) {
        await trx("product_images").insert(newImgPaths);
      }
    }

    return productId;
  });

  return returnedID;
}

/**
 * Updates an existing product.
 * @param {number} productId - The product ID to update
 * @param {Object} productData - Product data to update
 * @returns {Promise<void>}
 * @throws {Error} If product not found
 */
export async function updateProduct(productId, productData) {
  const existingProduct = await productModel.findByProductIdForAdmin(productId);
  if (!existingProduct) {
    throw new Error("Product not found");
  }

  await productModel.updateProduct(productId, productData);
}

/**
 * Deletes a product.
 * @param {number} productId - The product ID to delete
 * @returns {Promise<void>}
 * @throws {Error} If product not found
 */
export async function deleteProduct(productId) {
  const existingProduct = await productModel.findByProductIdForAdmin(productId);
  if (!existingProduct) {
    throw new Error("Product not found");
  }

  await productModel.deleteProduct(productId);
}
