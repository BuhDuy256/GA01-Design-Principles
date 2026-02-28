/**
 * Auction State Module
 * -------------------------------------------------------
 * Single source of truth cho auction state resolution.
 *
 * Tất cả callers (route handlers, notifier, scripts) đều
 * import từ module này — không tự tính lại state.
 *
 * Module này là PURE: không import Express, không import DB,
 * không có side effect — có thể unit test mà không cần setup.
 *
 * States:
 *   ACTIVE    → Đang đấu giá, chưa hết hạn
 *   PENDING   → Hết hạn / closed_at set, có highest_bidder, chờ thanh toán
 *   SOLD      → is_sold = true, giao dịch hoàn tất
 *   CANCELLED → is_sold = false, đã huỷ
 *   EXPIRED   → Hết hạn, không có bidder nào
 */

/**
 * Xác định trạng thái hiện tại của một auction.
 *
 * @param {Object} product - Product row từ DB (hoặc bất kỳ object nào
 *   có các fields: is_sold, end_at, closed_at, highest_bidder_id)
 * @returns {'ACTIVE'|'PENDING'|'SOLD'|'CANCELLED'|'EXPIRED'} auction status
 *
 * @example
 *   const status = resolveAuctionStatus(product);
 *   if (status === 'PENDING') { ... }
 */
export function resolveAuctionStatus(product) {
  const now = new Date();
  const endDate = new Date(product.end_at);

  // Terminal states — is_sold được set explicitly bởi business logic
  if (product.is_sold === true) return 'SOLD';
  if (product.is_sold === false) return 'CANCELLED';

  // Auction đã kết thúc (hết hạn hoặc bị close sớm)
  const auctionEnded = endDate <= now || Boolean(product.closed_at);

  if (auctionEnded && product.highest_bidder_id) return 'PENDING';
  if (auctionEnded && !product.highest_bidder_id) return 'EXPIRED';

  // Mặc định: auction đang chạy bình thường
  return 'ACTIVE';
}

// ---------------------------------------------------------------------------
// Guard functions — access control helpers
// Caller không cần biết state string cụ thể, chỉ hỏi "có được làm X không?"
// ---------------------------------------------------------------------------

/**
 * Auction có đang nhận bid không?
 * @param {string} status - Output của resolveAuctionStatus()
 */
export const canBid = (status) => status === 'ACTIVE';

/**
 * Auction đã kết thúc và đang chờ thanh toán?
 * @param {string} status - Output của resolveAuctionStatus()
 */
export const canAccessOrder = (status) => status === 'PENDING';

/**
 * Auction đã vào trạng thái cuối (không thể thay đổi)?
 * @param {string} status - Output của resolveAuctionStatus()
 */
export const isTerminalState = (status) => status === 'SOLD' || status === 'CANCELLED';

/**
 * Product không còn public visible cho tất cả user?
 * Non-ACTIVE products chỉ visible cho seller và highest bidder.
 * @param {string} status - Output của resolveAuctionStatus()
 */
export const requiresAccessCheck = (status) => status !== 'ACTIVE';
