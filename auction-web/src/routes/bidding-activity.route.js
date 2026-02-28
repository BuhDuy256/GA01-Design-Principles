import express from "express";
import { isAuthenticated } from "../middlewares/auth.mdw.js";
import * as biddingActivityService from "../services/bidding-activity.service.js";
import { setErrorMessage } from "../utils/session.js";

const router = express.Router();

/**
 * Bidding Activity Routes
 * Follows Single Responsibility Principle: route handlers only manage HTTP concerns.
 * Business logic is delegated to the service layer.
 */

/**
 * GET /bidding-activity/watchlist
 * Display user's watchlist with pagination
 */
router.get("/watchlist", isAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const currentUserId = req.session.authUser.id;

    const watchlistData =
      await biddingActivityService.getWatchlistWithPagination(
        currentUserId,
        page,
        3, // items per page
      );

    res.render("vwAccount/watchlist", watchlistData);
  } catch (error) {
    console.error("Error loading watchlist:", error);
    setErrorMessage(req, "Unable to load watchlist");
    res.redirect("/");
  }
});

/**
 * GET /bidding-activity/bidding
 * Display products user is currently bidding on
 */
router.get("/bidding", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const biddingProducts =
      await biddingActivityService.getBiddingProducts(currentUserId);

    res.render("vwAccount/bidding-products", {
      activeSection: "bidding",
      products: biddingProducts,
    });
  } catch (error) {
    console.error("Error loading bidding products:", error);
    setErrorMessage(req, "Unable to load bidding products");
    res.redirect("/");
  }
});

/**
 * GET /bidding-activity/auctions
 * Display auctions won by user with rating information
 */
router.get("/auctions", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const wonAuctions =
      await biddingActivityService.getWonAuctionsWithRatings(currentUserId);

    res.render("vwAccount/won-auctions", {
      activeSection: "auctions",
      products: wonAuctions,
    });
  } catch (error) {
    console.error("Error loading won auctions:", error);
    setErrorMessage(req, "Unable to load won auctions");
    res.redirect("/");
  }
});

export default router;
