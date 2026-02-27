## Phân tích Auction State Machine

### Vấn đề: State logic rải rác, không có nguồn sự thật duy nhất

Hiện tại không có module nào là authoritative về auction states. Logic xác định state được viết lại ở nhiều chỗ.

---

### Các states hiện tại

```
ACTIVE    → Đang đấu giá, chưa hết hạn
PENDING   → Hết hạn/closed_at, có highest_bidder, chờ thanh toán
SOLD      → is_sold = true, giao dịch hoàn tất
CANCELLED → is_sold = false, đã huỷ
EXPIRED   → Hết hạn, không có bidder nào
```

---

### Vị trí logic xác định state

Logic 5-nhánh if/else này xuất hiện **ít nhất 2 lần** nguyên vẹn:

**`GET /detail`** (product.route.js):

```js
if (product.is_sold === true)                               → SOLD
else if (product.is_sold === false)                         → CANCELLED
else if ((endDate <= now || product.closed_at) && highest)  → PENDING
else if (endDate <= now && !highest)                        → EXPIRED
else                                                        → ACTIVE
```

**`GET /complete-order`** (product.route.js) — copy y chang đoạn trên.

Ngoài ra **auto-close side effect** nằm trong `GET /detail`:

```js
if (endDate <= now && !product.closed_at && product.is_sold === null) {
  await productModel.updateProduct(productId, { closed_at: endDate });
}
```

Đây là **state transition** (`ACTIVE → PENDING/EXPIRED`) đang xảy ra bên trong một GET handler — side effect không mong muốn trong read operation.

---

### Phân tích transition triggers

| Transition                   | Trigger hiện tại                                  | Vấn đề                               |
| ---------------------------- | ------------------------------------------------- | ------------------------------------ |
| `ACTIVE → PENDING`           | Auction end time + có bidder                      | Xảy ra khi user load trang chi tiết  |
| `ACTIVE → EXPIRED`           | Auction end time + không có bidder                | Xảy ra khi user load trang chi tiết  |
| `ACTIVE → PENDING` (buy-now) | `POST /bid` hoặc `POST /buy-now`                  | OK — explicit trigger                |
| `ACTIVE → CANCELLED`         | `POST /seller/products/:id/cancel`                | OK — explicit trigger                |
| `PENDING → SOLD`             | `POST /submit-rating` hoặc `complete-transaction` | Rating flow quyết định product state |
| `PENDING → SOLD`             | `auctionEndNotifier`                              | Background job cũng có thể trigger   |

**Vấn đề lớn nhất:** `ACTIVE → PENDING/EXPIRED` transition xảy ra lazily khi user load trang, không phải tại thời điểm auction thực sự kết thúc. `auctionEndNotifier` chạy định kỳ nhưng không set `closed_at` — chỉ gửi email.

---

### Đề xuất: tách `auction-state.js`

```js
// services/auction-state.js

export function resolveStatus(product) {
  const now = new Date();
  const endDate = new Date(product.end_at);

  if (product.is_sold === true)  return 'SOLD';
  if (product.is_sold === false) return 'CANCELLED';
  if ((endDate <= now || product.closed_at) && product.highest_bidder_id) return 'PENDING';
  if (endDate <= now && !product.highest_bidder_id) return 'EXPIRED';
  return 'ACTIVE';
}

export function canBid(status)        { return status === 'ACTIVE'; }
export function canViewDetail(status, userId, product) { ... }
export function canAccessOrder(status) { return status === 'PENDING'; }
```

Và chuyển auto-close logic vào `auctionEndNotifier` hoặc một scheduled job riêng — **không để trong GET handler**.

---

### Kết quả mong muốn

- Một nơi duy nhất quyết định state — không còn duplicate logic.
- GET handler không có side effect ghi DB.
- Thêm state mới chỉ sửa `auction-state.js`.
- `auctionEndNotifier` dùng cùng `resolveStatus()` — không tự tính lại.
