import express from "express";
import * as systemService from "../../services/admin.system.service.js";
import { setSuccessMessage, setErrorMessage } from "../../utils/session.js";

const router = express.Router();

/**
 * Admin System Routes
 * Follows Single Responsibility Principle: route handlers only manage HTTP concerns.
 * Business logic is delegated to the service layer.
 */

/**
 * GET /admin/system/settings
 * Display system settings configuration page
 */
router.get("/settings", async (req, res) => {
  try {
    const settings = await systemService.getAllSettings();

    res.render("vwAdmin/system/setting", {
      settings,
      success_message: req.query.success,
    });
  } catch (error) {
    console.error("Error loading settings:", error);
    const settings = systemService.DEFAULT_SETTINGS;

    res.render("vwAdmin/system/setting", {
      settings,
      error_message: "Failed to load system settings",
    });
  }
});

/**
 * POST /admin/system/settings
 * Update system settings with validation
 */
router.post("/settings", async (req, res) => {
  try {
    const result = await systemService.updateSettings(req.body);

    if (result.success) {
      setSuccessMessage(
        req,
        `Settings updated successfully! (${result.updatedCount} settings updated)`,
      );
      res.redirect("/admin/system/settings");
    } else {
      // Some validations failed
      setErrorMessage(req, result.errors.join(", "));

      // Re-render form with submitted values
      const settings = await systemService.getAllSettings();
      res.render("vwAdmin/system/setting", {
        settings,
        error_message: result.errors.join(", "),
      });
    }
  } catch (error) {
    console.error("Error updating settings:", error);
    setErrorMessage(req, "Failed to update settings. Please try again.");

    const settings = await systemService.getAllSettings();
    res.render("vwAdmin/system/setting", {
      settings,
      error_message: "Failed to update settings. Please try again.",
    });
  }
});

export default router;
