/**
 * Email templates for comment notifications
 */

/**
 * Email to seller when new question is posted
 */
function sellerNewQuestionEmail({
  sellerName,
  productName,
  commenterName,
  content,
  productUrl,
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #667eea;">New Question About Your Product</h2>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Product:</strong> ${productName}</p>
        <p><strong>From:</strong> ${commenterName}</p>
        <p><strong>Question:</strong></p>
        <p style="background-color: white; padding: 15px; border-radius: 5px;">${content}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Product & Answer
        </a>
      </div>
    </div>
  `;
}

/**
 * Email to seller when new reply is posted
 */
function sellerNewReplyEmail({
  sellerName,
  productName,
  commenterName,
  content,
  productUrl,
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #667eea;">New Reply on Your Product</h2>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Product:</strong> ${productName}</p>
        <p><strong>From:</strong> ${commenterName}</p>
        <p><strong>Reply:</strong></p>
        <p style="background-color: white; padding: 15px; border-radius: 5px;">${content}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Product & Reply
        </a>
      </div>
    </div>
  `;
}

/**
 * Email to bidders/commenters when seller answers a question
 */
function sellerAnswerEmail({
  recipientName,
  productName,
  sellerName,
  content,
  productUrl,
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #667eea;">Seller Response on Product</h2>
      <p>Dear <strong>${recipientName}</strong>,</p>
      <p>The seller has responded to a question on a product you're interested in:</p>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Product:</strong> ${productName}</p>
        <p><strong>Seller:</strong> ${sellerName}</p>
        <p><strong>Answer:</strong></p>
        <p style="background-color: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">${content}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Product
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">This is an automated message from Online Auction. Please do not reply to this email.</p>
    </div>
  `;
}

export { sellerNewQuestionEmail, sellerNewReplyEmail, sellerAnswerEmail };
