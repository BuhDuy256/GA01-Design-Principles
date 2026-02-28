import * as reviewModel from '../models/review.model.js';
import * as orderModel from '../models/order.model.js';
import * as productModel from '../models/product.model.js';


const checkAndCompleteOrder = async (order, userId) => {
    
    const [buyerReview, sellerReview] = await Promise.all([
        reviewModel.getProductReview(order.buyer_id, order.seller_id, order.product_id),
        reviewModel.getProductReview(order.seller_id, order.buyer_id, order.product_id)
    ]);

    if (buyerReview && sellerReview) {
        await orderModel.updateStatus(order.id, 'completed', userId);
        await productModel.markProductAsSold(order.product_id);
    }
};

// Sumit rating and comment
export const submitRating = async (order, userId, rating, comment) => {
    const isBuyer = order.buyer_id === userId;
    const revieweeId = isBuyer ? order.seller_id : order.buyer_id;
    const ratingValue = rating === 'positive' ? 1 : -1;

    const existingReview = await reviewModel.findByReviewerAndProduct(userId, order.product_id);

    if (existingReview) {
        await reviewModel.updateByReviewerAndProduct(userId, order.product_id, {
            rating: ratingValue,
            comment: comment || null
        });
    } else {
        await reviewModel.create({
            reviewer_id: userId,
            reviewed_user_id: revieweeId,
            product_id: order.product_id,
            rating: ratingValue,
            comment: comment || null
        });
    }

    // Reuse the same logic to check if we can complete the order
    await checkAndCompleteOrder(order, userId);
};

// Skip rating and complete transaction
export const skipRating = async (order, userId) => {
    const isBuyer = order.buyer_id === userId;
    const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

    const existingReview = await reviewModel.findByReviewerAndProduct(userId, order.product_id);

    if (!existingReview) {
        await reviewModel.create({
            reviewer_id: userId,
            reviewed_user_id: revieweeId,
            product_id: order.product_id,
            rating: 0, // 0 = skipped
            comment: null
        });
    }

    // Reuse the same logic to check if we can complete the order
    await checkAndCompleteOrder(order, userId);
};

export const processPaymentSubmission = async (orderId, userId, paymentData) => {
    const { 
        payment_method, 
        payment_proof_urls, 
        note, 
        shipping_address, 
        shipping_phone 
    } = paymentData;

    // Create payment invoice
    await invoiceModel.createPaymentInvoice({
        order_id: orderId,
        issuer_id: userId,
        payment_method,
        payment_proof_urls,
        note
    });

    // Update shipping info
    await orderModel.updateShippingInfo(orderId, {
        shipping_address,
        shipping_phone
    });

    // Update order status to 'payment_submitted'
    await orderModel.updateStatus(orderId, 'payment_submitted', userId);
};

export const sendMessage = async (orderId, userId, message) => {
    await orderChatModel.sendMessage({
          order_id: orderId,
          sender_id: userId,
          message
        });
}