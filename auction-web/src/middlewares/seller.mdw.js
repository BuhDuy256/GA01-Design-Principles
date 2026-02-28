import * as userModel from "../models/user.model.js";
import { setErrorMessage } from "../utils/session.js";

/**
 * Seller Middleware
 * Provides middleware for loading seller-related data.
 * Follows DRY principle by centralizing seller data loading logic.
 */

/**
 * Loads all sellers and attaches them to res.locals for view access.
 * Use this middleware before routes that need seller data in forms.
 * @example router.use(['/add', '/edit/:id'], loadSellers);
 */
export async function loadSellers(req, res, next) {
  try {
    res.locals.sellers = await userModel.findUsersByRole("seller");
    next();
  } catch (error) {
    console.error("Error loading sellers:", error);
    res.locals.sellers = [];
    setErrorMessage(req, "Failed to load sellers list");
    next();
  }
}
