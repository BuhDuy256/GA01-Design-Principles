## Phân tích Bidding ↔ Order Coupling

### Vấn đề: Auction domain và Order domain bị trộn lẫn trong cùng một route file

`product.route.js` hiện chứa cả bidding logic lẫn order lifecycle — hai domain hoàn toàn khác nhau không có boundary rõ ràng.

---

### Điểm giao nhau hiện tại

#### 1. `POST /bid` tạo ra PENDING state → trigger Order domain

Khi `buyNowTriggered = true`, bid transaction set:

```js
updateData.end_at = new Date();
updateData.closed_at = new Date();
// is_sold = NULL → product chuyển sang PENDING
```

Sau đó `GET /complete-order` phải **tự detect** PENDING và **auto-create Order** nếu chưa có:

```js
let order = await orderModel.findByProductId(productId);
if (!order) {
  await orderModel.createOrder(orderData); // fallback trong route handler
}
```

Vấn đề: Order creation bị defer sang route khác thay vì xảy ra ngay tại thời điểm auction kết thúc.

#### 2. `POST /buy-now` cũng tạo PENDING — nhưng không tạo Order

`POST /buy-now` đóng auction ngay lập tức nhưng **không tạo Order**. Order chỉ được tạo khi user navigate đến `/complete-order`. Nếu user không vào trang đó, Order không tồn tại.

#### 3. Order routes nằm trong `product.route.js`

Tất cả các routes sau đang sống cùng file với bid/search/watchlist:

```
POST /order/:orderId/submit-payment
POST /order/:orderId/confirm-payment
POST /order/:orderId/submit-shipping
POST /order/:orderId/confirm-delivery
POST /order/:orderId/submit-rating
POST /order/:orderId/complete-transaction
POST /order/:orderId/send-message
GET  /order/:orderId/messages
GET  /complete-order
POST /order/upload-images
```

---

### Dependency flow hiện tại

```
product.route.js
    ├── bid logic     → productModel, biddingHistoryModel, autoBiddingModel
    ├── order logic   → orderModel, invoiceModel, orderChatModel
    └── rating logic  → reviewModel
         ↑ tất cả đều gọi db trực tiếp, không có service layer
```

---

### Vấn đề cụ thể

| Vấn đề                                    | Vị trí                                        | Hậu quả                                             |
| ----------------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| Order auto-create là fallback trong route | `GET /complete-order`                         | Order có thể không tồn tại nếu user bỏ qua bước này |
| Buy-now không tạo Order ngay              | `POST /buy-now`                               | Inconsistent với auction-end flow                   |
| Rating tạo trong order completion         | `POST /submit-rating`, `complete-transaction` | Rating logic coupled với Order status               |
| `is_sold = true` set trong rating route   | `submit-rating`, `complete-transaction`       | Product state được quyết định bởi Rating flow       |

---

### Đề xuất boundary

```
Auction Domain                    Order Domain
──────────────────                ──────────────────────
POST /bid                         GET  /complete-order
POST /buy-now           →event→   POST /order/:id/submit-payment
GET  /detail                      POST /order/:id/confirm-payment
GET  /search                      POST /order/:id/submit-shipping
GET  /category                    POST /order/:id/confirm-delivery
POST /watchlist                   POST /order/:id/submit-rating
DELETE /watchlist                 POST /order/:id/complete-transaction
POST /reject-bidder               POST /order/:id/send-message
POST /unreject-bidder             GET  /order/:id/messages
                                  POST /order/upload-images
```

Khi auction kết thúc (PENDING), `auction.service` emit một event/gọi `order.service.createOrderFromAuction()` ngay lập tức — không defer sang route handler.
