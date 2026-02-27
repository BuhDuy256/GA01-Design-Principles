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
