/**
 * Pagination Utility
 * Provides reusable pagination calculation logic.
 * Follows DRY principle by centralizing pagination logic used across multiple routes.
 */

/**
 * Calculates pagination metadata for a given dataset.
 * @param {number} page - Current page number (1-indexed)
 * @param {number} limit - Number of items per page
 * @param {number} totalCount - Total number of items
 * @returns {Object} Pagination metadata
 */
export function calculatePagination(page, limit, totalCount) {
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;

  if (to > totalCount) to = totalCount;
  if (totalCount === 0) {
    from = 0;
    to = 0;
  }

  return {
    currentPage: page,
    totalPages: nPages,
    from,
    to,
    totalCount,
  };
}

/**
 * Calculates offset for database queries based on page and limit.
 * @param {number} page - Current page number (1-indexed)
 * @param {number} limit - Number of items per page
 * @returns {number} Offset for database query
 */
export function calculateOffset(page, limit) {
  return (page - 1) * limit;
}

/**
 * Parses and validates page number from query parameter.
 * @param {string|number} pageParam - Page parameter from query string
 * @param {number} defaultPage - Default page number (default: 1)
 * @returns {number} Valid page number
 */
export function parsePageNumber(pageParam, defaultPage = 1) {
  const page = parseInt(pageParam);
  return isNaN(page) || page < 1 ? defaultPage : page;
}

/**
 * Creates complete pagination data structure for views.
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} totalCount - Total number of items
 * @param {Object} additionalData - Additional data to merge (e.g., query params)
 * @returns {Object} Complete pagination data for rendering
 */
export function createPaginationData(
  page,
  limit,
  totalCount,
  additionalData = {},
) {
  const pagination = calculatePagination(page, limit, totalCount);
  return {
    ...pagination,
    ...additionalData,
  };
}
