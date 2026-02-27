import * as reviewModel from '../models/review.model.js';



export const enrichProductWithReview = async (product , sellerId) => {
    if (product.status === 'Cancelled' && !product.highest_bidder_id) {
        return { ...product, hasReview: false };
    }

    // If the product has no bidders, we can skip the review check entirely (optimization)
    if (!product.highest_bidder_id) {
        return { ...product, hasReview: false };
    }

    const review = await reviewModel.getProductReview(sellerId, product.highest_bidder_id, product.id);
    const hasActualReview = review && review.rating !== 0;

    return {
        ...product,
        hasReview: hasActualReview,
        // If there's an actual review, use its rating and comment; otherwise, set them to null/empty
        reviewRating: hasActualReview ? (review.rating === 1 ? 'positive' : 'negative') : null,
        reviewComment: hasActualReview ? review.comment : ''
    };
}

export const enrichProductsWithReviews = async (products, sellerId) => {
    const enrichedProducts = await Promise.all(products.map(product => enrichProductWithReview(product, sellerId)));
    return enrichedProducts;
}



export const upsertProductRating = async (sellerId, productId, bidderId, rating, comment) => {
    if (!bidderId) {
        throw new Error('NO_BIDDER');
    }

    // Map rating: positive -> 1, negative -> -1
    const ratingValue = rating === 'positive' ? 1 : -1;

    // Check if already rated
    const existingReview = await reviewModel.findByReviewerAndProduct(sellerId, productId);

    if (existingReview) {
        // Update
        await reviewModel.updateByReviewerAndProduct(sellerId, productId, {
            rating: ratingValue,
            comment: comment || null
        });
        return 'UPDATED';
    } else {
        // Create new review
        await reviewModel.createReview({
            reviewer_id: sellerId,
            reviewee_id: bidderId,
            product_id: productId,
            rating: ratingValue,
            comment: comment || ''
        });
        return 'CREATED';
    }
};