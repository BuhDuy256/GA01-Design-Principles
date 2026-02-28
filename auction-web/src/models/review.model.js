import db from '../utils/db.js';

export function calculateRatingPoint(user_id) {
  return db('reviews')
    .where('reviewee_id', user_id)
    .select(
      db.raw(`
                CASE 
                    WHEN (COUNT(CASE WHEN rating = -1 THEN 1 END) + COUNT(CASE WHEN rating = 1 THEN 1 END)) = 0 
                    THEN 0
                    ELSE 
                        COUNT(CASE WHEN rating = 1 THEN 1 END)::float / 
                        (COUNT(CASE WHEN rating = -1 THEN 1 END) + COUNT(CASE WHEN rating = 1 THEN 1 END))
                END as rating_point
            `)
    )
    .first();
}

/**
 * Lấy tất cả reviews của user (được đánh giá)
 * @param {number} user_id - ID của user
 * @returns {Promise<Array>} Danh sách reviews
 */
export function getReviewsByUserId(user_id) {
  return db('reviews')
    .join('users as reviewer', 'reviews.reviewer_id', 'reviewer.id')
    .join('products', 'reviews.product_id', 'products.id')
    .where('reviews.reviewee_id', user_id)
    .whereNot('reviews.rating', 0) // Exclude skipped reviews (rating=0)
    .select(
      'reviews.*',
      'reviewer.fullname as reviewer_name',
      'products.name as product_name'
    )
    .orderBy('reviews.created_at', 'desc');
}

/**
 * Tạo review mới — API duy nhất cho INSERT.
 * Thay thế cho cả createReview(reviewData) lẫn create(data) cũ.
 *
 * @param {Object} params
 * @param {number} params.reviewerId   - ID người đánh giá
 * @param {number} params.revieweeId   - ID người được đánh giá
 * @param {number} params.productId    - ID sản phẩm
 * @param {number} params.rating       - 1 (positive), -1 (negative), 0 (skipped)
 * @param {string} [params.comment]    - Nội dung đánh giá (tùy chọn)
 * @returns {Promise} Kết quả insert
 */
export function createReview({ reviewerId, revieweeId, productId, rating, comment = null }) {
  return db('reviews').insert({
    reviewer_id: reviewerId,
    reviewee_id: revieweeId,
    product_id: productId,
    rating,
    comment,
    created_at: new Date()
  }).returning('*');
}
/**
 * Lấy review của reviewer cho reviewee trên product cụ thể
 * @param {number} reviewer_id - ID người đánh giá
 * @param {number} reviewee_id - ID người được đánh giá
 * @param {number} product_id - ID sản phẩm
 * @returns {Promise<Object>} Review object hoặc null
 */
export function getProductReview(reviewer_id, reviewee_id, product_id) {
  return db('reviews')
    .where('reviewer_id', reviewer_id)
    .where('reviewee_id', reviewee_id)
    .where('product_id', product_id)
    .first();
}

/**
 * Cập nhật review — API duy nhất cho UPDATE.
 * Thay thế cho cả updateReview(reviewer, reviewee, product, data) lẫn
 * updateByReviewerAndProduct(reviewer, product, data) cũ.
 *
 * (reviewer_id, product_id) đã đủ unique — một người chỉ review
 * một lần cho một sản phẩm, không cần reviewee_id trong WHERE.
 *
 * @param {number} reviewerId   - ID người đánh giá
 * @param {number} productId    - ID sản phẩm
 * @param {Object} updateData   - Dữ liệu cập nhật {rating, comment}
 * @returns {Promise} Kết quả update
 */
export function updateReview(reviewerId, productId, updateData) {
  return db('reviews')
    .where('reviewer_id', reviewerId)
    .where('product_id', productId)
    .update(updateData);
}

/**
 * Tìm review theo reviewer và product (không cần biết reviewee)
 * @param {number} reviewer_id - ID người đánh giá
 * @param {number} product_id - ID sản phẩm
 * @returns {Promise<Object>} Review object hoặc null
 */
export function findByReviewerAndProduct(reviewer_id, product_id) {
  return db('reviews')
    .where('reviewer_id', reviewer_id)
    .where('product_id', product_id)
    .first();
}
