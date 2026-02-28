import multer from "multer";
import path from "path";

/**
 * Upload Middleware
 * Provides configured multer instances for file uploads.
 * Follows Single Responsibility Principle by separating upload configuration.
 */

/**
 * Multer storage configuration for product images.
 * Files are temporarily stored in public/uploads/ before being moved to final location.
 */
const productImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

/**
 * Configured multer instance for product image uploads.
 * Reusable across different routes that need product image uploads.
 */
export const uploadProductImage = multer({ storage: productImageStorage });

/**
 * Middleware for uploading a single thumbnail image.
 * Usage: router.post('/upload-thumbnail', uploadSingleThumbnail, handler);
 */
export const uploadSingleThumbnail = uploadProductImage.single("thumbnail");

/**
 * Middleware for uploading multiple sub-images (up to 10).
 * Usage: router.post('/upload-subimages', uploadMultipleSubImages, handler);
 */
export const uploadMultipleSubImages = uploadProductImage.array("images", 10);
