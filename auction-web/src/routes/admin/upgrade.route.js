import express from "express";
import * as adminUpgradeService from "../../services/admin.upgrade.service.js";
import { setSuccessMessage, setErrorMessage } from "../../utils/session.js";

const router = express.Router();

/**
 * Admin Upgrade Routes
 * Follows Single Responsibility Principle: route handlers only manage HTTP concerns.
 * Business logic and validation are delegated to the service layer.
 */

/**
 * GET /admin/users/upgrade-requests
 * Display all upgrade requests
 */
router.get("/upgrade-requests", async (req, res) => {
  try {
    const requests = await adminUpgradeService.getAllUpgradeRequests();
    res.render("vwAdmin/users/upgradeRequests", { requests });
  } catch (error) {
    console.error("Error loading upgrade requests:", error);
    setErrorMessage(req, "Failed to load upgrade requests");
    res.redirect("/admin/users");
  }
});

/**
 * POST /admin/users/upgrade/approve
 * Approve an upgrade request and promote bidder to seller
 */
router.post("/upgrade/approve", async (req, res) => {
  try {
    const { id, bidder_id } = req.body;

    // Basic validation
    if (!id || !bidder_id) {
      setErrorMessage(req, "Request ID and Bidder ID are required");
      return res.redirect("/admin/users/upgrade-requests");
    }

    await adminUpgradeService.approveUpgradeRequest(id, bidder_id);
    setSuccessMessage(
      req,
      "Upgrade request approved successfully! User is now a seller.",
    );
    res.redirect("/admin/users/upgrade-requests");
  } catch (error) {
    console.error("Error approving upgrade request:", error);
    setErrorMessage(req, error.message || "Failed to approve upgrade request");
    res.redirect("/admin/users/upgrade-requests");
  }
});

/**
 * POST /admin/users/upgrade/reject
 * Reject an upgrade request with optional admin note
 */
router.post("/upgrade/reject", async (req, res) => {
  try {
    const { id, admin_note } = req.body;

    // Basic validation
    if (!id) {
      setErrorMessage(req, "Request ID is required");
      return res.redirect("/admin/users/upgrade-requests");
    }

    await adminUpgradeService.rejectUpgradeRequest(id, admin_note);
    setSuccessMessage(req, "Upgrade request rejected.");
    res.redirect("/admin/users/upgrade-requests");
  } catch (error) {
    console.error("Error rejecting upgrade request:", error);
    setErrorMessage(req, error.message || "Failed to reject upgrade request");
    res.redirect("/admin/users/upgrade-requests");
  }
});

export default router;
