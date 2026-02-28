import express from "express";
import * as homeService from "../services/home.service.js";
import { setErrorMessage } from "../utils/session.js";

const router = express.Router();

/**
 * Home Routes
 * Follows Single Responsibility Principle: route handlers only manage HTTP concerns.
 * Business logic is delegated to the service layer.
 */

/**
 * GET /
 * Display home page with featured products
 */
router.get("/", async (req, res) => {
  try {
    const featuredProducts = await homeService.getFeaturedProducts();
    res.render("home", featuredProducts);
  } catch (err) {
    console.error("Error loading home page:", err);
    setErrorMessage(req, "Unable to load featured products");
    res.status(500).send("Internal Server Error");
  }
});

export default router;
