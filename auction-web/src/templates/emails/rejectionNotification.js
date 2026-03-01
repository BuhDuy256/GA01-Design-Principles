/**
 * Email template for bidder rejection notification
 */

/**
 * Email to bidder when they are rejected by seller
 */
function rejectedBidderEmail({ bidderName, productName, sellerName, homeUrl }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Bid Rejected</h1>
      </div>
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p>Dear <strong>${bidderName}</strong>,</p>
        <p>We regret to inform you that the seller has rejected your bid on the following product:</p>
        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <h3 style="margin: 0 0 10px 0; color: #333;">${productName}</h3>
          <p style="margin: 5px 0; color: #666;"><strong>Seller:</strong> ${sellerName}</p>
        </div>
        <p style="color: #666;">This means you can no longer place bids on this specific product. Your previous bids on this product have been removed.</p>
        <p style="color: #666;">You can still participate in other auctions on our platform.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${homeUrl}" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Browse Other Auctions
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">If you believe this was done in error, please contact our support team.</p>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px; text-align: center;">This is an automated message from Online Auction. Please do not reply to this email.</p>
    </div>
  `;
}

export { rejectedBidderEmail };
