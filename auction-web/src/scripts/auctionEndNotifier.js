/**
 * Auction End Notifier
 * Script kiểm tra và gửi email thông báo khi đấu giá kết thúc
 */

import * as productModel from '../models/product.model.js';
import { resolveAuctionStatus } from '../services/auction/auction-state.js';
import { createOrderFromAuction } from '../services/order.service.js';
import { sendAuctionEndedNotifications } from '../services/notification.service.js';

/**
 * Kiểm tra các đấu giá kết thúc và gửi email thông báo
 */
export async function checkAndNotifyEndedAuctions() {
  try {
    const endedAuctions = await productModel.getNewlyEndedAuctions();

    if (endedAuctions.length === 0) {
      return;
    }

    console.log(`📧 Found ${endedAuctions.length} ended auctions to notify`);

    for (const auction of endedAuctions) {
      try {
        const productUrl = `${process.env.BASE_URL || 'http://localhost:3005'}/products/detail?id=${auction.id}`;
        const auctionStatus = resolveAuctionStatus(auction);

        // Có người thắng (PENDING state)
        if (auctionStatus === 'PENDING') {
          // Domain transition: time-based expiry path.
          // Create Order immediately so buyers can access /complete-order without race conditions.
          // createOrderFromAuction is idempotent — safe to call here even if already created.
          await createOrderFromAuction({
            productId: auction.id,
            buyerId: auction.highest_bidder_id,
            sellerId: auction.seller_id,
            finalPrice: auction.current_price
          });

          // Delegate email building and sending to notification.service.
          // auctionEndNotifier is a scheduler — it owns timing/iteration logic,
          // not email content or template construction.
          await sendAuctionEndedNotifications({ auction, productUrl, auctionStatus });
        } else if (auctionStatus === 'EXPIRED') {
          // Không có người thắng - Chỉ thông báo cho người bán
          await sendAuctionEndedNotifications({ auction, productUrl, auctionStatus });
        }

        // Đánh dấu đã gửi thông báo
        await productModel.markEndNotificationSent(auction.id);

      } catch (emailError) {
        console.error(`❌ Failed to send notification for product #${auction.id}:`, emailError);
      }
    }

  } catch (error) {
    console.error('❌ Error checking ended auctions:', error);
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
