/**
 * Calculate pagination parameters
 * @param {number|string} page - Current page number from query params (1-indexed)
 * @param {number|string} totalCount - Total number of items
 * @param {number} limit - Items per page (default: 3)
 * @returns {Object} Pagination parameters: offset, currentPage, totalPages, totalCount, from, to, limit
 */
function paginate(page, totalCount, limit = 3) {
  const currentPage = parseInt(page) || 1;
  const total = parseInt(totalCount) || 0;
  const offset = (currentPage - 1) * limit;
  const totalPages = Math.ceil(total / limit);

  let from = (currentPage - 1) * limit + 1;
  let to = currentPage * limit;

  if (to > total) to = total;
  if (total === 0) {
    from = 0;
    to = 0;
  }

  return {
    offset,
    currentPage,
    totalPages,
    totalCount: total,
    from,
    to,
    limit
  };
}

module.exports = { paginate };
