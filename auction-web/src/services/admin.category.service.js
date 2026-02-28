import * as categoryModel from "../models/category.model.js";

/**
 * Admin Category Service
 * Encapsulates business logic for category management operations.
 * Follows Single Responsibility Principle by separating business logic from HTTP handling.
 */

/**
 * Retrieves all categories with their relationships and product counts.
 * @returns {Promise<Array>} List of all categories
 */
export async function getAllCategories() {
  return await categoryModel.findAll();
}

/**
 * Retrieves a specific category by ID with its details.
 * @param {number} categoryId - The category ID
 * @returns {Promise<Object|null>} Category details or null if not found
 */
export async function getCategoryById(categoryId) {
  return await categoryModel.findByCategoryId(categoryId);
}

/**
 * Retrieves all level 1 (parent) categories for form selections.
 * @returns {Promise<Array>} List of parent categories
 */
export async function getParentCategories() {
  return await categoryModel.findLevel1Categories();
}

/**
 * Creates a new category with validation.
 * @param {Object} categoryData - Category creation data
 * @param {string} categoryData.name - Category name
 * @param {number|null} categoryData.parent_id - Parent category ID (null for level 1)
 * @returns {Promise<Object>} Created category
 * @throws {Error} If validation fails
 */
export async function createCategory(categoryData) {
  const { name, parent_id } = categoryData;

  // Validation
  if (!name || name.trim() === "") {
    throw new Error("Category name is required");
  }

  // Prepare data for insertion
  const categoryToCreate = {
    name: name.trim(),
    parent_id: parent_id || null,
  };

  const result = await categoryModel.createCategory(categoryToCreate);
  return result;
}

/**
 * Updates an existing category with validation.
 * @param {number} categoryId - The category ID to update
 * @param {Object} categoryData - Category update data
 * @param {string} categoryData.name - Category name
 * @param {number|null} categoryData.parent_id - Parent category ID
 * @returns {Promise<Object>} Updated category
 * @throws {Error} If validation fails or category not found
 */
export async function updateCategory(categoryId, categoryData) {
  const { name, parent_id } = categoryData;

  // Validation
  if (!name || name.trim() === "") {
    throw new Error("Category name is required");
  }

  // Check if category exists
  const existingCategory = await categoryModel.findByCategoryId(categoryId);
  if (!existingCategory) {
    throw new Error("Category not found");
  }

  // Prevent circular reference (a category cannot be its own parent)
  if (parent_id && parseInt(parent_id) === parseInt(categoryId)) {
    throw new Error("A category cannot be its own parent");
  }

  // Prepare data for update
  const categoryToUpdate = {
    name: name.trim(),
    parent_id: parent_id || null,
  };

  const result = await categoryModel.updateCategory(
    categoryId,
    categoryToUpdate,
  );
  return result;
}

/**
 * Deletes a category if it has no associated products.
 * Enforces business rule: categories with products cannot be deleted.
 * @param {number} categoryId - The category ID to delete
 * @returns {Promise<void>}
 * @throws {Error} If category has associated products or not found
 */
export async function deleteCategory(categoryId) {
  // Check if category exists
  const existingCategory = await categoryModel.findByCategoryId(categoryId);
  if (!existingCategory) {
    throw new Error("Category not found");
  }

  // Business rule: check if category has products
  const hasProducts = await categoryModel.isCategoryHasProducts(categoryId);
  if (hasProducts) {
    throw new Error("Cannot delete category that has associated products");
  }

  await categoryModel.deleteCategory(categoryId);
}

/**
 * Prepares data required for add category form.
 * @returns {Promise<Object>} Form data including parent categories
 */
export async function getAddCategoryFormData() {
  const parentCategories = await getParentCategories();
  return { parentCategories };
}

/**
 * Prepares data required for edit category form.
 * @param {number} categoryId - The category ID to edit
 * @returns {Promise<Object>} Form data including category and parent categories
 * @throws {Error} If category not found
 */
export async function getEditCategoryFormData(categoryId) {
  const category = await getCategoryById(categoryId);
  if (!category) {
    throw new Error("Category not found");
  }

  const parentCategories = await getParentCategories();
  return { category, parentCategories };
}
