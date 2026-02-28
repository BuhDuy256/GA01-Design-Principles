import express from "express";
import * as categoryService from "../../services/admin.category.service.js";
import { setSuccessMessage, setErrorMessage } from "../../utils/session.js";

const router = express.Router();

/**
 * Admin Category Routes
 * Follows Single Responsibility Principle: route handlers only manage HTTP concerns.
 * Business logic is delegated to the service layer.
 */

/**
 * GET /admin/categories/list
 * Display all categories
 */
router.get("/list", async (req, res) => {
  try {
    const categories = await categoryService.getAllCategories();

    res.render("vwAdmin/category/list", {
      categories,
      empty: categories.length === 0,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    setErrorMessage(req, "Failed to load categories");
    res.redirect("/admin");
  }
});

/**
 * GET /admin/categories/detail/:id
 * Display category details
 */
router.get("/detail/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const category = await categoryService.getCategoryById(id);

    if (!category) {
      setErrorMessage(req, "Category not found");
      return res.redirect("/admin/categories/list");
    }

    res.render("vwAdmin/category/detail", { category });
  } catch (error) {
    console.error("Error fetching category details:", error);
    setErrorMessage(req, "Failed to load category details");
    res.redirect("/admin/categories/list");
  }
});

/**
 * GET /admin/categories/add
 * Display add category form
 */
router.get("/add", async (req, res) => {
  try {
    const { parentCategories } = await categoryService.getAddCategoryFormData();
    res.render("vwAdmin/category/add", { parentCategories });
  } catch (error) {
    console.error("Error loading add category form:", error);
    setErrorMessage(req, "Failed to load form");
    res.redirect("/admin/categories/list");
  }
});

/**
 * GET /admin/categories/edit/:id
 * Display edit category form
 */
router.get("/edit/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { category, parentCategories } =
      await categoryService.getEditCategoryFormData(id);
    res.render("vwAdmin/category/edit", { category, parentCategories });
  } catch (error) {
    console.error("Error loading edit category form:", error);
    setErrorMessage(req, error.message || "Failed to load form");
    res.redirect("/admin/categories/list");
  }
});

/**
 * POST /admin/categories/add
 * Create a new category
 */
router.post("/add", async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    await categoryService.createCategory({ name, parent_id });
    setSuccessMessage(req, "Category added successfully!");
    res.redirect("/admin/categories/list");
  } catch (error) {
    console.error("Error creating category:", error);
    setErrorMessage(req, error.message || "Failed to create category");
    res.redirect("/admin/categories/add");
  }
});

/**
 * POST /admin/categories/edit
 * Update an existing category
 */
router.post("/edit", async (req, res) => {
  try {
    const { id, name, parent_id } = req.body;
    await categoryService.updateCategory(id, { name, parent_id });
    setSuccessMessage(req, "Category updated successfully!");
    res.redirect("/admin/categories/list");
  } catch (error) {
    console.error("Error updating category:", error);
    setErrorMessage(req, error.message || "Failed to update category");
    res.redirect(`/admin/categories/edit/${req.body.id}`);
  }
});

/**
 * POST /admin/categories/delete
 * Delete a category
 */
router.post("/delete", async (req, res) => {
  try {
    const { id } = req.body;
    await categoryService.deleteCategory(id);
    setSuccessMessage(req, "Category deleted successfully!");
    res.redirect("/admin/categories/list");
  } catch (error) {
    console.error("Error deleting category:", error);
    setErrorMessage(req, error.message || "Failed to delete category");
    res.redirect("/admin/categories/list");
  }
});

export default router;
