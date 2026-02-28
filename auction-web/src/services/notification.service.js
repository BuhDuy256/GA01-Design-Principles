/**
 * notification.service.js
 *
 * Centralized notification dispatch layer.
 *
 * Responsibilities:
 *   - Build and send all outbound emails for the auction platform.
 *   - Provide named, high-level notification functions to callers.
 *   - Own the email HTML template (layout + content) — single source of truth.
 *
 * This module does NOT:
 *   - Contain auction state resolution logic (see auction-state.js).
 *   - Know about DB models or business rules.
 *   - Import Express; it has no HTTP dependency.
 *
 * Callers:
 *   - auction.service.js  → sendBidNotifications()
 *   - auctionEndNotifier.js → sendAuctionEndedNotifications()
 *
 * Related issue: #7 (DRY — duplicated email templates across modules)
 */

import { sendMail } from '../utils/mailer.js';

// ---------------------------------------------------------------------------
// Private layout builder — single source of truth for email HTML structure.
// Every email produced by this service goes through this function.
// Changing brand color, font, footer copy: one place only.
//
// @param {string}  headerGradient  CSS linear-gradient string for the header
// @param {string}  title           Text inside the <h1> header
// @param {string}  bodyHtml        Inner HTML rendered inside the content panel
// @returns {string}  Complete HTML email string
// ---------------------------------------------------------------------------
function buildEmailLayout({ headerGradient, title, bodyHtml }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${headerGradient}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">${title}</h1>
      </div>
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        ${bodyHtml}
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px; text-align: center;">
        This is an automated message from Online Auction. Please do not reply to this email.
      </p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Private CTA button builder
// ---------------------------------------------------------------------------
function buildCtaButton({ href, label, color1 = '#72AEC8', color2 = '#5a9ab8' }) {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${href}" style="display: inline-block; background: linear-gradient(135deg, ${color1} 0%, ${color2} 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        ${label}
      </a>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// BID NOTIFICATIONS
// Called fire-and-forget by auction.service after a successful bid.
// ---------------------------------------------------------------------------

/**
 * Send email notifications to all parties interested in a bid event:
 * the seller, the current bidder (who just bid), and the previous highest bidder.
 *
 * @param {{ result: object, productId: number, productUrl: string }}
 */
export async function sendBidNotifications({ result, productId, productUrl }) {
  try {
    const emailPromises = [];

    if (result.sellerEmail) {
      emailPromises.push(_sendBidSellerEmail({ result, productUrl }));
    }
    if (result.currentBidderEmail) {
      emailPromises.push(_sendBidCurrentBidderEmail({ result, productUrl }));
    }
    if (result.previousBidderEmail && result.priceChanged) {
      emailPromises.push(_sendBidPreviousBidderEmail({ result, productUrl }));
    }

    if (emailPromises.length > 0) {
      await Promise.all(emailPromises);
      console.log(`${emailPromises.length} bid notification email(s) sent for product #${productId}`);
    }
  } catch (emailError) {
    console.error('Failed to send bid notification emails:', emailError);
  }
}

function _sendBidSellerEmail({ result, productUrl }) {
  const bodyHtml = `
    <p>Dear <strong>${result.sellerName}</strong>,</p>
    <p>Great news! Your product has received a new bid:</p>
    <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #72AEC8;">
      <h3 style="margin: 0 0 15px 0; color: #333;">${result.productName}</h3>
      <p style="margin: 5px 0;"><strong>Current Price:</strong></p>
      <p style="font-size: 28px; color: #72AEC8; margin: 5px 0; font-weight: bold;">
        ${new Intl.NumberFormat('en-US').format(result.newCurrentPrice)} VND
      </p>
      ${result.previousPrice !== result.newCurrentPrice ? `
      <p style="margin: 5px 0; color: #666; font-size: 14px;">
        <i>Previous: ${new Intl.NumberFormat('en-US').format(result.previousPrice)} VND</i>
      </p>` : ''}
    </div>
    ${result.productSold ? `
    <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p style="margin: 0; color: #155724;"><strong>🎉 Buy Now price reached!</strong> Auction has ended.</p>
    </div>` : ''}
    ${buildCtaButton({ href: productUrl, label: 'View Product' })}
  `;
  return sendMail({
    to: result.sellerEmail,
    subject: `💰 New bid on your product: ${result.productName}`,
    html: buildEmailLayout({
      headerGradient: 'linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%)',
      title: 'New Bid Received!',
      bodyHtml
    })
  });
}

function _sendBidCurrentBidderEmail({ result, productUrl }) {
  const isWinning = result.newHighestBidderId === result.userId;
  const accentColor = isWinning ? '#28a745' : '#ffc107';
  const accentColor2 = isWinning ? '#218838' : '#e0a800';

  const bodyHtml = `
    <p>Dear <strong>${result.currentBidderName}</strong>,</p>
    <p>${isWinning
      ? 'Congratulations! Your bid has been placed and you are currently the highest bidder!'
      : 'Your bid has been placed. However, another bidder has a higher maximum bid.'
    }</p>
    <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${accentColor};">
      <h3 style="margin: 0 0 15px 0; color: #333;">${result.productName}</h3>
      <p style="margin: 5px 0;"><strong>Your Max Bid:</strong> ${new Intl.NumberFormat('en-US').format(result.bidAmount)} VND</p>
      <p style="margin: 5px 0;"><strong>Current Price:</strong></p>
      <p style="font-size: 28px; color: ${accentColor}; margin: 5px 0; font-weight: bold;">
        ${new Intl.NumberFormat('en-US').format(result.newCurrentPrice)} VND
      </p>
    </div>
    ${result.productSold && isWinning ? `
    <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p style="margin: 0; color: #155724;"><strong>🎉 Congratulations! You won this product!</strong></p>
      <p style="margin: 10px 0 0 0; color: #155724;">Please proceed to complete your payment.</p>
    </div>` : ''}
    ${!isWinning ? `
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p style="margin: 0; color: #856404;"><strong>💡 Tip:</strong> Consider increasing your maximum bid to improve your chances of winning.</p>
    </div>` : ''}
    ${buildCtaButton({
      href: productUrl,
      label: result.productSold && isWinning ? 'Complete Payment' : 'View Auction',
      color1: accentColor,
      color2: accentColor2
    })}
  `;
  return sendMail({
    to: result.currentBidderEmail,
    subject: isWinning
      ? `✅ You're winning: ${result.productName}`
      : `📊 Bid placed: ${result.productName}`,
    html: buildEmailLayout({
      headerGradient: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor2} 100%)`,
      title: isWinning ? "You're Winning!" : 'Bid Placed',
      bodyHtml
    })
  });
}

function _sendBidPreviousBidderEmail({ result, productUrl }) {
  const wasOutbid = result.newHighestBidderId !== result.previousHighestBidderId;
  const accentColor = wasOutbid ? '#dc3545' : '#ffc107';
  const accentColor2 = wasOutbid ? '#c82333' : '#e0a800';

  const bodyHtml = `
    <p>Dear <strong>${result.previousBidderName}</strong>,</p>
    ${wasOutbid
      ? '<p>Unfortunately, another bidder has placed a higher bid on the product you were winning:</p>'
      : "<p>Good news! You're still the highest bidder, but the current price has been updated due to a new bid:</p>"
    }
    <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${accentColor};">
      <h3 style="margin: 0 0 15px 0; color: #333;">${result.productName}</h3>
      ${!wasOutbid ? `<p style="margin: 5px 0; color: #28a745;"><strong>✓ You're still winning!</strong></p>` : ''}
      <p style="margin: 5px 0;"><strong>New Current Price:</strong></p>
      <p style="font-size: 28px; color: ${accentColor}; margin: 5px 0; font-weight: bold;">
        ${new Intl.NumberFormat('en-US').format(result.newCurrentPrice)} VND
      </p>
      <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
        <i>Previous price: ${new Intl.NumberFormat('en-US').format(result.previousPrice)} VND</i>
      </p>
    </div>
    ${wasOutbid ? `
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p style="margin: 0; color: #856404;"><strong>💡 Don't miss out!</strong> Place a new bid to regain the lead.</p>
    </div>` : `
    <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <p style="margin: 0; color: #155724;"><strong>💡 Tip:</strong> Your automatic bidding is working! Consider increasing your max bid if you want more protection.</p>
    </div>`}
    ${buildCtaButton({
      href: productUrl,
      label: wasOutbid ? 'Place New Bid' : 'View Auction',
      color1: wasOutbid ? '#28a745' : '#72AEC8',
      color2: wasOutbid ? '#218838' : '#5a9ab8'
    })}
  `;
  return sendMail({
    to: result.previousBidderEmail,
    subject: wasOutbid
      ? `⚠️ You've been outbid: ${result.productName}`
      : `📊 Price updated: ${result.productName}`,
    html: buildEmailLayout({
      headerGradient: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor2} 100%)`,
      title: wasOutbid ? "You've Been Outbid!" : 'Price Updated',
      bodyHtml
    })
  });
}

// ---------------------------------------------------------------------------
// AUCTION END NOTIFICATIONS
// Called by auctionEndNotifier after a newly-ended auction is detected.
// ---------------------------------------------------------------------------

/**
 * Send end-of-auction notifications.
 * For PENDING (winner exists): notify winner + seller.
 * For EXPIRED (no bidders): notify seller only.
 *
 * @param {{ auction: object, productUrl: string, auctionStatus: string }}
 */
export async function sendAuctionEndedNotifications({ auction, productUrl, auctionStatus }) {
  try {
    if (auctionStatus === 'PENDING') {
      const emailPromises = [];
      if (auction.winner_email) {
        emailPromises.push(_sendAuctionWonEmail({ auction, productUrl }));
      }
      if (auction.seller_email) {
        emailPromises.push(_sendAuctionEndedSellerEmail({ auction, productUrl }));
      }
      if (emailPromises.length > 0) {
        await Promise.all(emailPromises);
      }
      console.log(`✅ Auction-end notifications (PENDING) sent for product #${auction.id}`);
    } else if (auctionStatus === 'EXPIRED') {
      if (auction.seller_email) {
        await _sendExpiredAuctionEmail({ auction });
        console.log(`✅ Auction-end notification (EXPIRED) sent for product #${auction.id}`);
      }
    }
  } catch (emailError) {
    console.error(`❌ Failed to send auction-end notification for product #${auction.id}:`, emailError);
  }
}

function _sendAuctionWonEmail({ auction, productUrl }) {
  const bodyHtml = `
    <p>Dear <strong>${auction.winner_name}</strong>,</p>
    <p>Congratulations! You have won the auction for:</p>
    <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #28a745;">
      <h3 style="margin: 0 0 10px 0; color: #333;">${auction.name}</h3>
      <p style="font-size: 24px; color: #28a745; margin: 0; font-weight: bold;">
        ${new Intl.NumberFormat('en-US').format(auction.current_price)} VND
      </p>
    </div>
    <p>Please complete your payment to finalize the purchase.</p>
    ${buildCtaButton({ href: productUrl, label: 'Complete Payment', color1: '#28a745', color2: '#218838' })}
    <p style="color: #666; font-size: 14px;">Please complete payment within 3 days to avoid order cancellation.</p>
  `;
  return sendMail({
    to: auction.winner_email,
    subject: `🎉 Congratulations! You won the auction: ${auction.name}`,
    html: buildEmailLayout({
      headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      title: '🎉 You Won!',
      bodyHtml
    })
  });
}

function _sendAuctionEndedSellerEmail({ auction, productUrl }) {
  const bodyHtml = `
    <p>Dear <strong>${auction.seller_name}</strong>,</p>
    <p>Your auction has ended with a winner!</p>
    <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #72AEC8;">
      <h3 style="margin: 0 0 10px 0; color: #333;">${auction.name}</h3>
      <p style="margin: 5px 0;"><strong>Winner:</strong> ${auction.winner_name}</p>
      <p style="font-size: 24px; color: #72AEC8; margin: 10px 0 0 0; font-weight: bold;">
        ${new Intl.NumberFormat('en-US').format(auction.current_price)} VND
      </p>
    </div>
    <p>The winner has been notified to complete payment. You will receive another notification once payment is confirmed.</p>
    ${buildCtaButton({ href: productUrl, label: 'View Product' })}
  `;
  return sendMail({
    to: auction.seller_email,
    subject: `🔔 Auction Ended: ${auction.name} - Winner Found!`,
    html: buildEmailLayout({
      headerGradient: 'linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%)',
      title: 'Auction Ended',
      bodyHtml
    })
  });
}

function _sendExpiredAuctionEmail({ auction }) {
  const newAuctionUrl = `${process.env.BASE_URL || 'http://localhost:3005'}/seller/add`;
  const bodyHtml = `
    <p>Dear <strong>${auction.seller_name}</strong>,</p>
    <p>Unfortunately, your auction has ended without any bidders.</p>
    <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #6c757d;">
      <h3 style="margin: 0 0 10px 0; color: #333;">${auction.name}</h3>
      <p style="color: #6c757d; margin: 0;">No bids received</p>
    </div>
    <p>You can relist this product or create a new auction with adjusted pricing.</p>
    ${buildCtaButton({ href: newAuctionUrl, label: 'Create New Auction' })}
  `;
  return sendMail({
    to: auction.seller_email,
    subject: `⏰ Auction Ended: ${auction.name} - No Bidders`,
    html: buildEmailLayout({
      headerGradient: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
      title: 'Auction Ended',
      bodyHtml
    })
  });
}

// ---------------------------------------------------------------------------
// COMMENT NOTIFICATIONS
// Called fire-and-forget by the POST /comment route after a comment is saved.
//
// Three cases:
//   1. Seller is replying to a question  → notify all interested bidders and commenters
//   2. Non-seller is replying to a thread → notify the seller ("new reply")
//   3. Non-seller is asking a new question → notify the seller ("new question")
// ---------------------------------------------------------------------------

/**
 * Dispatch comment-related email notifications.
 *
 * The caller is responsible for pre-fetching product, commenter, and seller
 * before calling this function. This service owns only the email routing
 * decision and template construction.
 *
 * @param {{
 *   product: object,          — full product row (needs .name, .seller_id)
 *   commenter: object,        — user who posted the comment (needs .fullname)
 *   seller: object|null,      — product seller (needs .email, .fullname)
 *   content: string,          — comment text
 *   parentId: number|null,    — parent comment id (null = top-level question)
 *   userId: number,           — id of the commenter
 *   productUrl: string,       — absolute URL to the product page
 *   bidders: object[],        — array of {id, email, fullname} (for seller-reply case)
 *   commenters: object[],     — array of {id, email, fullname} (for seller-reply case)
 * }}
 */
export async function sendCommentNotifications({
  product, commenter, seller, content, parentId, userId, productUrl,
  bidders = [], commenters = []
}) {
  try {
    const isSellerReplying = userId === product.seller_id;

    if (isSellerReplying && parentId) {
      // Case 1: Seller answered a question — notify all interested parties
      await _notifyInterestedParties({
        product, seller, content, productUrl,
        bidders, commenters
      });
    } else if (seller && seller.email && userId !== product.seller_id) {
      // Cases 2 & 3: Buyer/bidder activity — notify the seller
      if (parentId) {
        await _sendReplyNotificationToSeller({ product, commenter, seller, content, productUrl });
      } else {
        await _sendQuestionNotificationToSeller({ product, commenter, seller, content, productUrl });
      }
    }
  } catch (emailError) {
    console.error('Failed to send comment notification emails:', emailError);
  }
}

/**
 * Notify all bidders and commenters (deduped, excluding seller) when the
 * seller posts a reply.
 */
async function _notifyInterestedParties({ product, seller, content, productUrl, bidders, commenters }) {
  const recipientsMap = new Map();

  bidders.forEach(b => {
    if (b.id !== product.seller_id && b.email) {
      recipientsMap.set(b.id, { email: b.email, fullname: b.fullname });
    }
  });
  commenters.forEach(c => {
    if (c.id !== product.seller_id && c.email) {
      recipientsMap.set(c.id, { email: c.email, fullname: c.fullname });
    }
  });

  const sends = [];
  for (const recipient of recipientsMap.values()) {
    const bodyHtml = `
      <p>Dear <strong>${recipient.fullname}</strong>,</p>
      <p>The seller has responded to a question on a product you're interested in:</p>
      <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #667eea;">
        <p><strong>Product:</strong> ${product.name}</p>
        <p><strong>Seller:</strong> ${seller.fullname}</p>
        <p><strong>Answer:</strong></p>
        <p style="padding: 12px; border-radius: 5px; background: #f8f9fa;">${content}</p>
      </div>
      ${buildCtaButton({ href: productUrl, label: 'View Product', color1: '#667eea', color2: '#764ba2' })}
    `;
    sends.push(sendMail({
      to: recipient.email,
      subject: `Seller answered a question on: ${product.name}`,
      html: buildEmailLayout({
        headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        title: 'Seller Response',
        bodyHtml
      })
    }).catch(err => console.error(`Failed to send to ${recipient.email}:`, err)));
  }

  await Promise.all(sends);
  console.log(`Seller reply notification sent to ${recipientsMap.size} recipients`);
}

function _sendReplyNotificationToSeller({ product, commenter, seller, content, productUrl }) {
  const bodyHtml = `
    <p>Dear <strong>${seller.fullname}</strong>,</p>
    <p>A user has replied to a comment thread on your product:</p>
    <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #667eea;">
      <p><strong>Product:</strong> ${product.name}</p>
      <p><strong>From:</strong> ${commenter.fullname}</p>
      <p><strong>Reply:</strong></p>
      <p style="padding: 12px; border-radius: 5px; background: #f8f9fa;">${content}</p>
    </div>
    ${buildCtaButton({ href: productUrl, label: 'View Product & Reply', color1: '#667eea', color2: '#764ba2' })}
  `;
  return sendMail({
    to: seller.email,
    subject: `New reply on your product: ${product.name}`,
    html: buildEmailLayout({
      headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      title: 'New Reply',
      bodyHtml
    })
  });
}

function _sendQuestionNotificationToSeller({ product, commenter, seller, content, productUrl }) {
  const bodyHtml = `
    <p>Dear <strong>${seller.fullname}</strong>,</p>
    <p>A user has asked a question about your product:</p>
    <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #667eea;">
      <p><strong>Product:</strong> ${product.name}</p>
      <p><strong>From:</strong> ${commenter.fullname}</p>
      <p><strong>Question:</strong></p>
      <p style="padding: 12px; border-radius: 5px; background: #f8f9fa;">${content}</p>
    </div>
    ${buildCtaButton({ href: productUrl, label: 'View Product & Answer', color1: '#667eea', color2: '#764ba2' })}
  `;
  return sendMail({
    to: seller.email,
    subject: `New question about your product: ${product.name}`,
    html: buildEmailLayout({
      headerGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      title: 'New Question',
      bodyHtml
    })
  });
}

