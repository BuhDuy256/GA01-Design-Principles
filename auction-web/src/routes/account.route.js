import express from "express";
import { UserService } from "../services/user.service.js";
import * as accountService from "../services/account.service.js";
import { isAuthenticated } from "../middlewares/auth.mdw.js";
import {
  setSuccessMessage,
  setErrorMessage,
  getSuccessMessageFromQuery,
} from "../utils/session.js";

const router = express.Router();

/**
 * Account Routes
 * Follows Single Responsibility Principle: route handlers only manage HTTP concerns.
 * Business logic is delegated to the service layer.
 */

/**
 * GET /account/profile
 * Display user profile with success notifications
 */
router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const user = await accountService.getUserProfile(currentUserId);

    if (!user) {
      setErrorMessage(req, "User profile not found");
      return res.redirect("/");
    }

    // Get success message from query string
    const success_message = getSuccessMessageFromQuery(req.query);

    res.render("vwAccount/profile", {
      user,
      success_message,
    });
  } catch (err) {
    console.error("Error loading profile:", err);
    res.render("vwAccount/profile", {
      user: req.session.authUser,
      err_message: "Unable to load profile information.",
    });
  }
});

/**
 * PUT /account/profile
 * Update user profile
 */
router.put("/profile", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const { error, user, updatedUser } = await UserService.updateProfile(
      currentUserId,
      req.body,
    );

    if (error) {
      return res.render("vwAccount/profile", {
        user,
        err_message: error,
      });
    }

    // Update session with new user data
    if (updatedUser) {
      req.session.authUser = updatedUser;
    }

    return res.redirect("/account/profile?success=true");
  } catch (err) {
    console.error("Error updating profile:", err);
    return res.render("vwAccount/profile", {
      user: req.session.authUser,
      err_message: "System error. Please try again later.",
    });
  }
});

/**
 * GET /account/request-upgrade
 * Display upgrade request form
 */
router.get("/request-upgrade", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const upgradeRequest =
      await accountService.getUserUpgradeRequest(currentUserId);

    res.render("vwAccount/request-upgrade", {
      upgrade_request: upgradeRequest,
    });
  } catch (err) {
    console.error("Error loading upgrade request:", err);
    setErrorMessage(req, "Unable to load upgrade request information");
    res.redirect("/account/profile");
  }
});

/**
 * POST /account/request-upgrade
 * Submit upgrade request
 */
router.post("/request-upgrade", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    await accountService.submitUpgradeRequest(currentUserId);

    return res.redirect("/account/profile?send-request-upgrade=true");
  } catch (err) {
    console.error("Error submitting upgrade request:", err);
    setErrorMessage(
      req,
      err.message ||
        "Unable to submit your request at this time. Please try again later.",
    );
    res.redirect("/account/request-upgrade");
  }
});

/**
 * GET /account/seller/products
 * Display seller's products
 */
router.get("/seller/products", isAuthenticated, async (req, res) => {
  res.render("vwAccount/my-products");
});

/**
 * GET /account/seller/sold-products
 * Display seller's sold products
 */
router.get("/seller/sold-products", isAuthenticated, async (req, res) => {
  res.render("vwAccount/sold-products");
});

export default router;
