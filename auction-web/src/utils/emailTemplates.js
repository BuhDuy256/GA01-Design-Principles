// utils/emailTemplates.js
export const descriptionUpdateTemplate = (user, product, description, productUrl) => {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9bb8 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Product Description Updated</h1>
            </div>
            <div style="padding: 20px; background: #f9f9f9;">
                <p>Hello <strong>${user.fullname}</strong>,</p>
                <p>The seller has added new information to the product description:</p>
                <div style="background: white; padding: 15px; border-left: 4px solid #72AEC8; margin: 15px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">${product.name}</h3>
                    <p style="margin: 0; color: #666;">Current Price: <strong style="color: #72AEC8;">${new Intl.NumberFormat('en-US').format(product.current_price)} VND</strong></p>
                </div>
                <div style="background: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #f57c00;"><i>✉</i> New Description Added:</p>
                    <div style="color: #333;">${description}</div>
                </div>
                <p>View the product to see the full updated description:</p>
                <a href="${productUrl}" style="display: inline-block; background: #72AEC8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 10px 0;">View Product</a>
            </div>
        </div>
    `;
};


// Base layout for all emails
const baseEmailLayout = (title, content) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9bb8 100%); padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
      <h1 style="color: white; margin: 0;">${title}</h1>
    </div>
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px;">
      ${content}
    </div>
  </div>
`;

export const getWinnerEmailHtml = (auction, productUrl) => {
    const content = `
        <p>Dear <strong>${auction.winner_name}</strong>,</p>
        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #28A745;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${auction.name}</h3>
            <p style="font-size: 16px; color: #28a745; margin: 0; font-weight: bold;">
                You won at: ${new Intl.NumberFormat('en-US').format(auction.current_price)} VND
            </p>
        </div>
        <p>Please complete your payment to finalize the purchase.</p>
        <a href="${productUrl}" style="display: inline-block; background: #28A745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Complete Payment</a>
    `;
    return baseEmailLayout('🎉 Congratulations! You won!', content);
};

export const getSellerSuccessHtml = (auction, productUrl) => {
    // Tương tự, trả về nội dung cho seller khi có người mua...
    const content = `<p>Your auction <strong>${auction.name}</strong> has ended with a winner!</p> `;
    return baseEmailLayout('🔔 Auction Ended', content);
};

export const getSellerNoBidderHtml = (auction) => {
    // Nội dung khi không có ai mua...
    const content = `<p>Unfortunately, your auction <strong>${auction.name}</strong> ended without any bidders.</p> `;
    return baseEmailLayout('🔔 Auction Ended: No Bidders', content);
};