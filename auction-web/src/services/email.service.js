/**
 * Email Service
 * Centralizes email sending logic, error handling, and template rendering
 */

import { sendMail } from '../utils/mailer.js';
import * as userModel from '../models/user.model.js';
import { sellerNewBidEmail, currentBidderEmail, previousBidderEmail } from '../templates/emails/bidNotifications.js';
import { sellerNewQuestionEmail, sellerNewReplyEmail, sellerAnswerEmail } from '../templates/emails/commentNotifications.js';
import { rejectedBidderEmail } from '../templates/emails/rejectionNotification.js';

async function safeSendMail(emailConfig, context = 'email') {
  try {
    await sendMail(emailConfig);
    console.log(`${context} sent to ${emailConfig.to}`);
  } catch (emailError) {
    console.error(`Failed to send ${context}:`, emailError);
    // Error is logged but not thrown - emails are non-blocking
  }
}

async function sendBidNotifications({
  sellerId,
  currentBidderId,
  previousBidderId,
  productId,
  productName,
  newCurrentPrice,
  previousPrice,
  bidAmount,
  productSold,
  priceChanged,
  productUrl
}) {
  // Fire and forget - don't block the response
  (async () => {
    try {
      // Get user info for emails in parallel
      const [seller, currentBidder, previousBidder] = await Promise.all([
        userModel.findById(sellerId),
        userModel.findById(currentBidderId),
        previousBidderId && previousBidderId !== currentBidderId
          ? userModel.findById(previousBidderId)
          : null
      ]);

      // Prepare all email promises
      const emailPromises = [];

      // 1. Email to SELLER - New bid notification
      if (seller && seller.email) {
        emailPromises.push(
          safeSendMail({
            to: seller.email,
            subject: `💰 New bid on your product: ${productName}`,
            html: sellerNewBidEmail({
              sellerName: seller.fullname,
              productName,
              bidderName: currentBidder ? currentBidder.fullname : 'Anonymous',
              newCurrentPrice,
              previousPrice,
              productSold,
              productUrl
            })
          }, 'seller bid notification')
        );
      }

      // 2. Email to CURRENT BIDDER - Bid confirmation
      if (currentBidder && currentBidder.email) {
        const isWinning = true; // Current bidder is always the one who just bid
        emailPromises.push(
          safeSendMail({
            to: currentBidder.email,
            subject: isWinning
              ? `✅ You're winning: ${productName}`
              : `📊 Bid placed: ${productName}`,
            html: currentBidderEmail({
              bidderName: currentBidder.fullname,
              productName,
              bidAmount,
              newCurrentPrice,
              isWinning,
              productSold,
              productUrl
            })
          }, 'current bidder notification')
        );
      }

      // 3. Email to PREVIOUS HIGHEST BIDDER - Outbid notification
      if (previousBidder && previousBidder.email && priceChanged) {
        const wasOutbid = true; // If we're sending this, they were outbid
        emailPromises.push(
          safeSendMail({
            to: previousBidder.email,
            subject: wasOutbid
              ? `⚠️ You've been outbid: ${productName}`
              : `📊 Price updated: ${productName}`,
            html: previousBidderEmail({
              bidderName: previousBidder.fullname,
              productName,
              newCurrentPrice,
              previousPrice,
              wasOutbid,
              productUrl
            })
          }, 'previous bidder notification')
        );
      }

      // Send all emails in parallel
      if (emailPromises.length > 0) {
        await Promise.all(emailPromises);
        console.log(`${emailPromises.length} bid notification email(s) sent for product #${productId}`);
      }
    } catch (error) {
      console.error('Failed to send bid notification emails:', error);
      // Don't fail - emails are sent asynchronously
    }
  })(); // Execute immediately but don't wait
}

async function sendSellerCommentNotification({
  sellerId,
  commenterId,
  productName,
  content,
  isReply,
  productUrl
}) {
  // Fire and forget
  (async () => {
    try {
      const [seller, commenter] = await Promise.all([
        userModel.findById(sellerId),
        userModel.findById(commenterId)
      ]);

      if (seller && seller.email && commenter) {
        const templateFn = isReply ? sellerNewReplyEmail : sellerNewQuestionEmail;
        await safeSendMail({
          to: seller.email,
          subject: isReply
            ? `New reply on your product: ${productName}`
            : `New question about your product: ${productName}`,
          html: templateFn({
            sellerName: seller.fullname,
            productName,
            commenterName: commenter.fullname,
            content,
            productUrl
          })
        }, 'seller comment notification');
      }
    } catch (error) {
      console.error('Failed to send seller comment notification:', error);
    }
  })();
}

async function sendSellerAnswerNotification({
  productId,
  productName,
  sellerName,
  content,
  productUrl,
  recipients // Array of { id, email, fullname }
}) {
  // Fire and forget
  (async () => {
    try {
      const emailPromises = recipients.map(recipient =>
        safeSendMail({
          to: recipient.email,
          subject: `Seller answered a question on: ${productName}`,
          html: sellerAnswerEmail({
            recipientName: recipient.fullname,
            productName,
            sellerName,
            content,
            productUrl
          })
        }, `seller answer notification to ${recipient.email}`)
      );

      if (emailPromises.length > 0) {
        await Promise.all(emailPromises);
        console.log(`Seller reply notification sent to ${emailPromises.length} recipients`);
      }
    } catch (error) {
      console.error('Failed to send seller answer notifications:', error);
    }
  })();
}

async function sendRejectionNotification({
  bidderId,
  productId,
  productName,
  sellerName,
  homeUrl
}) {
  // Fire and forget
  (async () => {
    try {
      const bidder = await userModel.findById(bidderId);

      if (bidder && bidder.email) {
        await safeSendMail({
          to: bidder.email,
          subject: `Your bid has been rejected: ${productName}`,
          html: rejectedBidderEmail({
            bidderName: bidder.fullname,
            productName,
            sellerName: sellerName || 'N/A',
            homeUrl
          })
        }, `rejection notification to ${bidder.email}`);

        console.log(`Rejection email sent to ${bidder.email} for product #${productId}`);
      }
    } catch (error) {
      console.error('Failed to send rejection notification:', error);
    }
  })();
}

export {
  sendBidNotifications,
  sendSellerCommentNotification,
  sendSellerAnswerNotification,
  sendRejectionNotification
};
