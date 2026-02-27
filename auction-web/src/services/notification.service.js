import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
import { sendMail } from '../utils/mailer.js';
import * as emailTemplates from '../utils/emailTemplates.js';

export const notifyUsersAboutDescriptionUpdate = async (product, description, sellerId, productUrl) => {
    // List of users to notify (bidders and commenters)
    const [bidders, commenters] = await Promise.all([
        biddingHistoryModel.getUniqueBidders(product.id),
        productCommentModel.getUniqueCommenters(product.id)
    ]);

    // Filter out the seller and duplicate users, then prepare the notification list
    const notifyMap = new Map();
    [...bidders, ...commenters].forEach(user => {
        if (user.id !== sellerId && !notifyMap.has(user.email)) {
            notifyMap.set(user.email, user);
        }
    });

    const notifyUsers = Array.from(notifyMap.values());
    if (notifyUsers.length === 0) return;

    // Send notification emails in parallel
    Promise.all(notifyUsers.map(user => {
        const htmlContent = emailTemplates.descriptionUpdateTemplate(user, product, description, productUrl);
        
        return sendMail({
            to: user.email,
            subject: `[Auction Update] New description added for "${product.name}"`,
            html: htmlContent
        }).catch(err => console.error('Failed to send email to', user.email, err));
    })).catch(err => console.error('Email notification error:', err));
};