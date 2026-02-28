import express from "express";
import * as adminProductService from "../../services/admin.product.service.js";
import { setSuccessMessage, setErrorMessage } from "../../utils/session.js";
import { loadSellers } from "../../middlewares/seller.mdw.js";
import {
  uploadSingleThumbnail,
  uploadMultipleSubImages,
} from "../../middlewares/upload.mdw.js";

const router = express.Router();

/**
 * Admin Product Routes
 * Follows Single Responsibility Principle: route handlers only manage HTTP concerns.
 * Business logic is delegated to the service layer.
 */

/**
 * GET /admin/products/list
 * Display all products
 */
router.get("/list", async (req, res) => {
  try {
    const products = await adminProductService.getAllProducts();
    res.render("vwAdmin/product/list", {
      products,
      empty: products.length === 0,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    setErrorMessage(req, "Failed to load products");
    res.redirect("/admin");
  }
});

/**
 * Middleware to load sellers for add/edit forms
 * Applied to routes that need seller data
 */
router.use(["/add", "/edit/:id"], loadSellers);

/**
 * GET /admin/products/add
 * Display add product form
 */
router.get("/add", async (req, res) => {
  res.render("vwAdmin/product/add");
});

/**
 * POST /admin/products/add
 * Create a new product with images
 */
router.post("/add", async (req, res) => {
  try {
    const productData = adminProductService.transformProductFormData(req.body);
    const imgs = JSON.parse(req.body.imgs_list);

    await adminProductService.createProductWithImages(
      productData,
      req.body.thumbnail,
      imgs,
    );

    setSuccessMessage(req, "Product added successfully!");
    res.redirect("/admin/products/list");
  } catch (error) {
    console.error("Error creating product:", error);
    setErrorMessage(req, error.message || "Failed to create product");
    res.redirect("/admin/products/add");
  }
});

/**
 * GET /admin/products/detail/:id
 * Display product details
 */
router.get("/detail/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const product = await adminProductService.getProductById(id);

    if (!product) {
      setErrorMessage(req, "Product not found");
      return res.redirect("/admin/products/list");
    }

    res.render("vwAdmin/product/detail", { product });
  } catch (error) {
    console.error("Error fetching product details:", error);
    setErrorMessage(req, "Failed to load product details");
    res.redirect("/admin/products/list");
  }
});

/**
 * GET /admin/products/edit/:id
 * Display edit product form
 */
router.get("/edit/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const product = await adminProductService.getProductById(id);

    if (!product) {
      setErrorMessage(req, "Product not found");
      return res.redirect("/admin/products/list");
    }

    res.render("vwAdmin/product/edit", { product });
  } catch (error) {
    console.error("Error loading edit product form:", error);
    setErrorMessage(req, error.message || "Failed to load form");
    res.redirect("/admin/products/list");
  }
});

/**
 * POST /admin/products/edit
 * Update an existing product
 */
router.post("/edit", async (req, res) => {
  try {
    const { id, ...productData } = req.body;
    await adminProductService.updateProduct(id, productData);
    setSuccessMessage(req, "Product updated successfully!");
    res.redirect("/admin/products/list");
  } catch (error) {
    console.error("Error updating product:", error);
    setErrorMessage(req, error.message || "Failed to update product");
    res.redirect(`/admin/products/edit/${req.body.id}`);
  }
});

/**
 * POST /admin/products/delete
 * Delete a product
 */
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;
    await adminProductService.deleteProduct(id);
    setSuccessMessage(req, "Product deleted successfully!");
    res.redirect("/admin/products/list");
  } catch (error) {
    console.error("Error deleting product:", error);
    setErrorMessage(req, error.message || "Failed to delete product");
    res.redirect("/admin/products/list");
  }
});

/**
 * POST /admin/products/upload-thumbnail
 * Upload product thumbnail
 */
router.post("/upload-thumbnail", uploadSingleThumbnail, async (req, res) => {
  res.json({
    success: true,
    file: req.file,
  });
});

/**
 * POST /admin/products/upload-subimages
 * Upload product sub-images (up to 10)
 */
router.post("/upload-subimages", uploadMultipleSubImages, async (req, res) => {
  res.json({
    success: true,
    files: req.files,
  });
});

export default router;
