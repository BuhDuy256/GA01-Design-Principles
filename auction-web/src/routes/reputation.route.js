import express from "express";
import { isAuthenticated } from "../middlewares/auth.mdw.js";
import * as reputationService from "../services/reputation.service.js";

const router = express.Router();

router.get("/ratings", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.authUser.id;
    const reputationData =
      await reputationService.getUserReputationData(currentUserId);

    res.render("vwAccount/rating", {
      activeSection: "ratings",
      ...reputationData,
    });
  } catch (error) {
    console.error("Error loading ratings:", error);
    res.status(500).render("500", { message: "Failed to load ratings" });
  }
});

// Rate Seller - POST
router.post(
  "/won-auctions/:productId/rate-seller",
  isAuthenticated,
  async (req, res) => {
    try {
      const currentUserId = req.session.authUser.id;
      const productId = req.params.productId;
      const { seller_id, rating, comment } = req.body;

      await reputationService.rateSellerForProduct({
        reviewerId: currentUserId,
        sellerId: seller_id,
        productId,
        rating,
        comment,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error rating seller:", error);
      res.json({ success: false, message: "Failed to submit rating." });
    }
  },
);

// Rate Seller - PUT (Edit)
router.put(
  "/won-auctions/:productId/rate-seller",
  isAuthenticated,
  async (req, res) => {
    try {
      const currentUserId = req.session.authUser.id;
      const productId = req.params.productId;
      const { rating, comment, seller_id } = req.body;

      await reputationService.rateSellerForProduct({
        reviewerId: currentUserId,
        sellerId: seller_id,
        productId,
        rating,
        comment,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating rating:", error);
      res.json({ success: false, message: "Failed to update rating." });
    }
  },
);

export default router;
