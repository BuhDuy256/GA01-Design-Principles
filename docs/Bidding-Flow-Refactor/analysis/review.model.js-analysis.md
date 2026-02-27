## Phân tích review.model.js

### Vấn đề: API không nhất quán — 2 pathway để làm cùng một việc

`review.model.js` export **2 cặp hàm trùng chức năng** với tên và signature khác nhau:

#### Insert pathway (2 hàm làm cùng việc)

| Hàm                        | Signature                                                                                                                                        | Được gọi từ                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `createReview(reviewData)` | Nhận object thô, mapping 1-1 với DB schema                                                                                                       | Không tìm thấy call site hiện tại                                      |
| `create(data)`             | Nhận `{ reviewer_id, reviewed_user_id, product_id, rating, comment }` — note: field là `reviewed_user_id` nhưng map thành `reviewee_id` trong DB | `product.route.js` (submit-rating, complete-transaction, buy-now flow) |

Vấn đề: `createReview` dùng `reviewData.reviewee_id`, còn `create` dùng `data.reviewed_user_id` — **tên field khác nhau cho cùng một column**. Caller phải biết dùng hàm nào với field name nào.

#### Update pathway (2 hàm làm cùng việc)

| Hàm                                                               | Signature | Điều kiện WHERE                     |
| ----------------------------------------------------------------- | --------- | ----------------------------------- |
| `updateReview(reviewer_id, reviewee_id, product_id, updateData)`  | 4 params  | WHERE reviewer + reviewee + product |
| `updateByReviewerAndProduct(reviewer_id, product_id, updateData)` | 3 params  | WHERE reviewer + product            |

`updateByReviewerAndProduct` là superset — bỏ `reviewee_id` khỏi WHERE vì `(reviewer_id, product_id)` đã đủ unique (một người chỉ review một lần cho một sản phẩm). `updateReview` có thêm `reviewee_id` nhưng thực tế thừa.

Call site trong `product.route.js` dùng `updateByReviewerAndProduct`, `updateReview` không có call site.

---

### Tóm tắt API hiện tại

```
review.model.js exports:
├── calculateRatingPoint(user_id)        ← OK, dùng nhiều nơi
├── getReviewsByUserId(user_id)          ← OK
├── getProductReview(reviewer, reviewee, product) ← OK, dùng để check "cả 2 đã rate chưa"
├── findByReviewerAndProduct(reviewer, product)   ← OK, dùng để check trước khi write
│
├── createReview(reviewData)             ← DEAD — không có call site
├── create(data)                         ← ACTIVE — nhưng field name không nhất quán
│
├── updateReview(reviewer, reviewee, product, data) ← DEAD — không có call site
└── updateByReviewerAndProduct(reviewer, product, data) ← ACTIVE
```

---

### Đề xuất chuẩn hóa

Giữ lại **một pathway duy nhất** cho write operations:

```js
// Thay thế create() + createReview() bằng một hàm duy nhất
export function createReview({ reviewerId, revieweeId, productId, rating, comment })

// Thay thế updateReview() + updateByReviewerAndProduct() bằng một hàm duy nhất
export function updateReview(reviewerId, productId, { rating, comment })

// Bỏ createReview() và updateReview() cũ (dead code)
```

Dùng camelCase nhất quán cho tất cả params — tránh lẫn lộn `reviewed_user_id` vs `reviewee_id`.

---

### Risk

Trước khi xóa `createReview` và `updateReview`, cần grep toàn bộ codebase để xác nhận không có call site nào bị bỏ sót (đặc biệt trong `seller.route.js` và `account.route.js`).
