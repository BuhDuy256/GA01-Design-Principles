import * as reviewModel from "../models/review.model.js";
import * as orderModel from "../models/order.model.js";
import * as productModel from "../models/product.model.js";
import * as invoiceModel from "../models/invoice.model.js";
import * as orderChatModel from "../models/orderChat.model.js";
import { parsePostgresArray } from "../utils/dbHelpers.js";

const checkAndCompleteOrder = async (order, userId) => {
  const [buyerReview, sellerReview] = await Promise.all([
    reviewModel.getProductReview(
      order.buyer_id,
      order.seller_id,
      order.product_id,
    ),
    reviewModel.getProductReview(
      order.seller_id,
      order.buyer_id,
      order.product_id,
    ),
  ]);

  if (buyerReview && sellerReview) {
    await orderModel.updateStatus(order.id, "completed", userId);
    await productModel.markProductAsSold(order.product_id);
  }
};

// Sumit rating and comment
export const submitRating = async (order, userId, rating, comment) => {
  const isBuyer = order.buyer_id === userId;
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;
  const ratingValue = rating === "positive" ? 1 : -1;

  const existingReview = await reviewModel.findByReviewerAndProduct(
    userId,
    order.product_id,
  );

  if (existingReview) {
    await reviewModel.updateByReviewerAndProduct(userId, order.product_id, {
      rating: ratingValue,
      comment: comment || null,
    });
  } else {
    await reviewModel.create({
      reviewer_id: userId,
      reviewed_user_id: revieweeId,
      product_id: order.product_id,
      rating: ratingValue,
      comment: comment || null,
    });
  }

  // Reuse the same logic to check if we can complete the order
  await checkAndCompleteOrder(order, userId);
};

// Skip rating and complete transaction
export const skipRating = async (order, userId) => {
  const isBuyer = order.buyer_id === userId;
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

  const existingReview = await reviewModel.findByReviewerAndProduct(
    userId,
    order.product_id,
  );

  if (!existingReview) {
    await reviewModel.create({
      reviewer_id: userId,
      reviewed_user_id: revieweeId,
      product_id: order.product_id,
      rating: 0, // 0 = skipped
      comment: null,
    });
  }

  // Reuse the same logic to check if we can complete the order
  await checkAndCompleteOrder(order, userId);
};

export const processPaymentSubmission = async (
  orderId,
  userId,
  paymentData,
) => {
  const {
    payment_method,
    payment_proof_urls,
    note,
    shipping_address,
    shipping_phone,
  } = paymentData;

  // Create payment invoice
  await invoiceModel.createPaymentInvoice({
    order_id: orderId,
    issuer_id: userId,
    payment_method,
    payment_proof_urls,
    note,
  });

  // Update shipping info
  await orderModel.updateShippingInfo(orderId, {
    shipping_address,
    shipping_phone,
  });

  // Update order status to 'payment_submitted'
  await orderModel.updateStatus(orderId, "payment_submitted", userId);
};

export const sendMessage = async (orderId, userId, message) => {
  await orderChatModel.sendMessage({
    order_id: orderId,
    sender_id: userId,
    message,
  });
};

/**
 * Formats raw chat messages for display in views.
 * Determines if message is sent or received and formats timestamps.
 * @param {Array} rawMessages - Raw messages from database
 * @param {number} currentUserId - ID of current user viewing messages
 * @returns {Array} Formatted messages for view rendering
 */
export const formatMessagesForView = (rawMessages, currentUserId) => {
  return rawMessages.map((msg) => ({
    message: msg.message,
    isSent: msg.sender_id === currentUserId,
    formattedDate: new Date(msg.created_at).toLocaleString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  }));
};

/**
 * Retrieves and formats messages for an order.
 * @param {number} orderId - Order ID
 * @param {number} currentUserId - Current user ID
 * @returns {Promise<Array>} Formatted messages
 */
export const getFormattedMessages = async (orderId, currentUserId) => {
  const rawMessages = await orderChatModel.getMessagesByOrderId(orderId);
  return formatMessagesForView(rawMessages, currentUserId);
};

export const getProductStatus = (product) => {
  const now = new Date();
  const endDate = new Date(product.end_at);

  if (product.is_sold === true) return "SOLD";
  if (product.is_sold === false) return "CANCELLED";
  if ((endDate <= now || product.closed_at) && product.highest_bidder_id)
    return "PENDING";
  if (endDate <= now && !product.highest_bidder_id) return "EXPIRED";

  return "ACTIVE";
};

export const getOrCreateOrder = async (product) => {
  let order = await orderModel.findByProductId(product.id);

  // Fallback: Auto-create order if not exists
  if (!order && product.highest_bidder_id) {
    const orderData = {
      product_id: product.id,
      buyer_id: product.highest_bidder_id,
      seller_id: product.seller_id,
      final_price: product.current_price || product.highest_bid || 0,
    };
    await orderModel.createOrder(orderData);
    order = await orderModel.findByProductId(product.id);
  }

  return order;
};

// Validation function to check product status and user authorization for order page
const validateProductForOrderPage = (product, userId) => {
  if (!product) {
    const error = new Error("Product not found");
    error.code = "PRODUCT_NOT_FOUND";
    throw error;
  }

  const productStatus = getProductStatus(product);
  if (productStatus !== "PENDING") {
    const error = new Error("Product is not in pending status");
    error.code = "NOT_PENDING";
    throw error;
  }

  const isSeller = product.seller_id === userId;
  const isHighestBidder = product.highest_bidder_id === userId;

  if (!isSeller && !isHighestBidder) {
    const error = new Error("Permission denied");
    error.code = "FORBIDDEN";
    throw error;
  }

  return { isSeller, isHighestBidder };
};

const mapInvoiceData = (rawPaymentInvoice, rawShippingInvoice) => {
  return {
    paymentInvoice: rawPaymentInvoice
      ? {
          ...rawPaymentInvoice,
          payment_proof_urls: parsePostgresArray(
            rawPaymentInvoice.payment_proof_urls,
          ),
        }
      : null,
    shippingInvoice: rawShippingInvoice
      ? {
          ...rawShippingInvoice,
          shipping_proof_urls: parsePostgresArray(
            rawShippingInvoice.shipping_proof_urls,
          ),
        }
      : null,
  };
};

export const buildCompleteOrderPageData = async (productId, userId) => {
  const product = await productModel.findByProductId2(productId, userId);

  // Validation
  const { isSeller, isHighestBidder } = validateProductForOrderPage(
    product,
    userId,
  );

  // Data fetching
  const order = await getOrCreateOrder(product);

  const [rawPaymentInvoice, rawShippingInvoice, messages] = await Promise.all([
    invoiceModel.getPaymentInvoice(order.id),
    invoiceModel.getShippingInvoice(order.id),
    orderChatModel.getMessagesByOrderId(order.id),
  ]);

  // Map invoice data to include parsed URLs
  const { paymentInvoice, shippingInvoice } = mapInvoiceData(
    rawPaymentInvoice,
    rawShippingInvoice,
  );

  return {
    product,
    order,
    paymentInvoice,
    shippingInvoice,
    messages,
    isSeller,
    isHighestBidder,
    currentUserId: userId,
  };
};
