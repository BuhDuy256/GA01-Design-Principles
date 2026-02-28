/**
 * Auction End Notifier
 * Script kiểm tra và gửi email thông báo khi đấu giá kết thúc
 */

import * as productModel from '../models/product.model.js';
import * as notificationService from '../services/notification.service.js';

/**
 * Kiểm tra các đấu giá kết thúc và gửi email thông báo
 */
export async function checkAndNotifyEndedAuctions() {
    try {
        const endedAuctions = await productModel.getNewlyEndedAuctions();
        
        if (!endedAuctions || endedAuctions.length === 0) {
            return;
        }

        console.log(`Found ${endedAuctions.length} ended auctions to notify.`);

        for (const auction of endedAuctions) {
            try {
                const productUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/products/detail?id=${auction.id}`;
                
                // Move logic to service
                await notificationService.notifyAuctionResult(auction, productUrl);
                
                // Update product to mark as notified (to avoid duplicate notifications)
                await productModel.markAsNotified(auction.id);

            } catch (emailError) {
                console.error(`Failed to send notification for product ${auction.id}:`, emailError);
            }
        }
    } catch (error) {
        console.error('Error checking ended auctions:', error);
    }
}

/**
 * Khởi chạy job định kỳ
 * @param {number} intervalSeconds - Khoảng thời gian giữa các lần kiểm tra (giây)
 */
export function startAuctionEndNotifier(intervalSeconds = 30) {
  console.log(`🚀 Auction End Notifier started (checking every ${intervalSeconds} second(s))`);

  // Chạy ngay lần đầu
  checkAndNotifyEndedAuctions();

  // Sau đó chạy định kỳ
  setInterval(checkAndNotifyEndedAuctions, intervalSeconds * 1000);
}
