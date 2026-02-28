import express from "express";
import * as adminUserService from "../../services/admin.user.service.js";
import { setSuccessMessage, setErrorMessage } from "../../utils/session.js";

const router = express.Router();

/**
 * Admin User Routes
 * Follows Single Responsibility Principle: route handlers only manage HTTP concerns.
 * Business logic is delegated to the service layer.
 */

/**
 * GET /admin/users/list
 * Display all users
 */
router.get("/list", async (req, res) => {
  try {
    const users = await adminUserService.getAllUsers();

    res.render("vwAdmin/users/list", {
      users,
      empty: users.length === 0,
    });
  } catch (error) {
    console.error("Error loading users:", error);
    setErrorMessage(req, "Failed to load users");
    res.redirect("/admin");
  }
});

/**
 * GET /admin/users/detail/:id
 * Display user details
 */
router.get("/detail/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const user = await adminUserService.getUserById(id);

    if (!user) {
      setErrorMessage(req, "User not found");
      return res.redirect("/admin/users/list");
    }

    res.render("vwAdmin/users/detail", { user });
  } catch (error) {
    console.error("Error loading user details:", error);
    setErrorMessage(req, "Failed to load user details");
    res.redirect("/admin/users/list");
  }
});

/**
 * GET /admin/users/add
 * Display add user form
 */
router.get("/add", async (req, res) => {
  res.render("vwAdmin/users/add");
});

/**
 * POST /admin/users/add
 * Create a new user
 */
router.post("/add", async (req, res) => {
  try {
    await adminUserService.createUser(req.body);
    setSuccessMessage(req, "User added successfully!");
    res.redirect("/admin/users/list");
  } catch (error) {
    console.error("Add user error:", error);
    setErrorMessage(
      req,
      error.message || "Failed to add user. Please try again.",
    );
    res.redirect("/admin/users/add");
  }
});

/**
 * GET /admin/users/edit/:id
 * Display edit user form
 */
router.get("/edit/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const user = await adminUserService.getUserById(id);

    if (!user) {
      setErrorMessage(req, "User not found");
      return res.redirect("/admin/users/list");
    }

    res.render("vwAdmin/users/edit", { user });
  } catch (error) {
    console.error("Error loading edit user form:", error);
    setErrorMessage(req, "Failed to load form");
    res.redirect("/admin/users/list");
  }
});

/**
 * POST /admin/users/edit
 * Update an existing user
 */
router.post("/edit", async (req, res) => {
  try {
    const { id, ...userData } = req.body;
    await adminUserService.updateUser(id, userData);
    setSuccessMessage(req, "User updated successfully!");
    res.redirect("/admin/users/list");
  } catch (error) {
    console.error("Update user error:", error);
    setErrorMessage(
      req,
      error.message || "Failed to update user. Please try again.",
    );
    res.redirect(`/admin/users/edit/${req.body.id}`);
  }
});

/**
 * POST /admin/users/reset-password
 * Reset user password to default and send notification email
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      setErrorMessage(req, "User ID is required");
      return res.redirect("/admin/users/list");
    }

    const user = await adminUserService.resetUserPassword(id);
    setSuccessMessage(
      req,
      `Password of ${user.fullname} reset successfully to default: 123`,
    );
    res.redirect("/admin/users/list");
  } catch (error) {
    console.error("Reset password error:", error);
    setErrorMessage(
      req,
      error.message || "Failed to reset password. Please try again.",
    );
    res.redirect("/admin/users/list");
  }
});

/**
 * POST /admin/users/delete
 * Delete a user
 */
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      setErrorMessage(req, "User ID is required");
      return res.redirect("/admin/users/list");
    }

    await adminUserService.deleteUser(id);
    setSuccessMessage(req, "User deleted successfully!");
    res.redirect("/admin/users/list");
  } catch (error) {
    console.error("Delete user error:", error);
    setErrorMessage(
      req,
      error.message || "Failed to delete user. Please try again.",
    );
    res.redirect("/admin/users/list");
  }
});

export default router;
