/**
 * Comment Service Layer
 * Handles product comment business logic and notifications
 */
import * as productCommentModel from '../models/productComment.model.js';
import * as productModel from '../models/product.model.js';
import * as userModel from '../models/user.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import { sendSellerCommentNotification, sendSellerAnswerNotification } from './email.service.js';

/**
 * Post a new comment on a product
 * @param {Object} params - Comment parameters
 * @returns {Promise<void>}
 */
export async function postComment({ productId, userId, content, parentId = null, productUrl }) {
  if (!content || content.trim().length === 0) {
    throw new Error('Comment cannot be empty');
  }

  // Create comment
  await productCommentModel.createComment(productId, userId, content.trim(), parentId);

  // Get product and seller for email notification
  const product = await productModel.findByProductId2(productId, null);
  const seller = await userModel.findById(product.seller_id);

  // Check if the commenter is the seller (seller is replying)
  const isSellerReplying = userId === product.seller_id;

  if (isSellerReplying && parentId) {
    // Seller is replying to a question - notify all bidders and commenters
    const bidders = await biddingHistoryModel.getUniqueBidders(productId);
    const commenters = await productCommentModel.getUniqueCommenters(productId);

    // Combine and remove duplicates (exclude seller)
    const recipientsMap = new Map();

    bidders.forEach(b => {
      if (b.id !== product.seller_id && b.email) {
        recipientsMap.set(b.id, { id: b.id, email: b.email, fullname: b.fullname });
      }
    });

    commenters.forEach(c => {
      if (c.id !== product.seller_id && c.email) {
        recipientsMap.set(c.id, { id: c.id, email: c.email, fullname: c.fullname });
      }
    });

    // Send seller answer notification via email service
    sendSellerAnswerNotification({
      productId,
      productName: product.name,
      sellerName: seller.fullname,
      content: content.trim(),
      productUrl,
      recipients: Array.from(recipientsMap.values())
    });
  } else if (seller && seller.email && userId !== product.seller_id) {
    // Non-seller commenting - send email to seller
    sendSellerCommentNotification({
      sellerId: product.seller_id,
      commenterId: userId,
      productName: product.name,
      content: content.trim(),
      isReply: !!parentId,
      productUrl
    });
  }
}
