# Phân Tích & Đề Xuất Refactoring — Issues #11, #12

> **Lưu ý thực tế từ grep codebase:** Tài liệu phân tích ban đầu (`violation-summary-table.md`) nhận định `createReview()` và `updateReview()` là _dead code_ (không có call site). Sau khi grep toàn bộ codebase, phát hiện **cả hai hàm đều được dùng trong `seller.route.js`**. Vi phạm thực sự không phải dead code — mà là **dual API inconsistency**: cùng một operation được expose qua hai hàm với naming convention khác nhau, dẫn đến caller không biết phải dùng hàm nào và truyền field name gì.

---

## Issue #11 — Dual INSERT API: `createReview()` vs `create()` (DRY + ISP)

### 1. Tìm kiếm vi phạm

**Nguyên tắc vi phạm:** DRY + ISP (Interface Segregation Principle — phía module)

**Hai hàm thực hiện cùng một INSERT operation:**

```javascript
// ——— Hàm 1: createReview(reviewData) — dùng snake_case thuần túy ———
export function createReview(reviewData) {
  return db("reviews").insert(reviewData).returning("*");
  // Caller (seller.route.js) phải truyền: { reviewer_id, reviewee_id, product_id, ... }
}

// ——— Hàm 2: create(data) — dùng snake_case nhưng field NAME khác ———
export function create(data) {
  return db("reviews").insert({
    reviewer_id: data.reviewer_id,
    reviewee_id: data.reviewed_user_id, // ← "reviewed_user_id" ≠ "reviewee_id"
    product_id: data.product_id,
    // ...
  });
  // Caller (product.route.js, account.route.js) phải truyền: { reviewer_id, reviewed_user_id, product_id, ... }
}
```

**Map các call sites thực tế:**

| File                                  | Hàm gọi                    | Field name truyền vào |
| ------------------------------------- | -------------------------- | --------------------- |
| `seller.route.js` (line 267)          | `createReview(reviewData)` | `reviewee_id`         |
| `product.route.js` (lines 1236, 1288) | `create(data)`             | `reviewed_user_id`    |
| `account.route.js` (line 617)         | `create(data)`             | `reviewed_user_id`    |

**Tại sao đây là DRY + ISP violation (technical reasoning):**

- **DRY**: Cùng một operation INSERT vào bảng `reviews` được encode hai lần: một lần trong `createReview()` (raw pass-through object), một lần trong `create()` (explicit field mapping). Database schema invariant — `reviewee_id` column — được refer đến bằng hai tên khác nhau trong hai hàm: `reviewee_id` và `reviewed_user_id`. Đây là **knowledge duplication** về field naming convention, không chỉ code duplication.

- **ISP (module API perspective)**: `review.model.js` expose hai entry points cho cùng một use case. Module client (caller) phải "biết nhiều hơn cần thiết" — không chỉ biết "muốn insert review" mà còn phải biết "nên gọi hàm nào" và "field name là gì cho hàm đó". ISP áp dụng ở tầng module: interface của `review.model.js` bắt client phụ thuộc vào sự phân biệt triển khai nội bộ không liên quan đến domain logic.

---

### 2. Đánh giá tác động

| Chiều tác động      | Hậu quả cụ thể                                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Maintainability** | Đổi DB schema (rename column `reviewee_id`) → phải sửa cả hai hàm **và** tất cả caller của từng hàm. Không có một điểm sửa duy nhất.                                                                                         |
| **Coupling**        | Caller bị coupled với naming convention nội bộ của từng hàm. `seller.route.js` dùng `reviewee_id`, `product.route.js` dùng `reviewed_user_id` — hai route kết quả là coupled với hai version khác nhau của cùng một concept. |
| **Error-proneness** | Developer mới đọc code thấy `reviewModel.create()` và `reviewModel.createReview()` — không rõ khác nhau gì, khi nào dùng cái nào. Dễ dẫn đến dùng nhầm hàm với field name sai → `reviewee_id` bị `null` silently.            |
| **Testability**     | Phải viết test cho cả hai hàm dù chúng test cùng một behavior. Effort nhân đôi, và hai test suite có thể drift theo thời gian.                                                                                               |
| **Regression risk** | Sửa behavior (ví dụ: thêm default `created_at` trong `create()` nhưng quên `createReview()`) → inconsistency giữa hai pathways INSERT.                                                                                       |

---

### 3. Đề xuất cải thiện

**Chiến lược:** Merge hai hàm thành một canonical function với destructuring parameters (camelCase nhất quán).

**Before:**

```javascript
// review.model.js — hai hàm, hai convention
export function createReview(reviewData) { ... }       // reviewData.reviewee_id
export function create(data) { ... }                   // data.reviewed_user_id

// seller.route.js
const reviewData = {
    reviewer_id: sellerId,
    reviewee_id: highest_bidder_id,  // snake_case, field là "reviewee_id"
    product_id: productId, ...
};
await reviewModel.createReview(reviewData);

// product.route.js
await reviewModel.create({
    reviewer_id: reviewerId,
    reviewed_user_id: revieweeId,    // snake_case, field là "reviewed_user_id"
    product_id: order.product_id, ...
});
```

**After:**

```javascript
// review.model.js — một hàm duy nhất, camelCase nhất quán
export function createReview({
  reviewerId,
  revieweeId,
  productId,
  rating,
  comment = null,
}) {
  return db("reviews")
    .insert({
      reviewer_id: reviewerId,
      reviewee_id: revieweeId, // mapping DB column ← domain param — ONE place
      product_id: productId,
      rating,
      comment,
      created_at: new Date(),
    })
    .returning("*");
}

// seller.route.js — caller không cần biết DB column name
await reviewModel.createReview({
  reviewerId: sellerId,
  revieweeId: highest_bidder_id, // camelCase, rõ nghĩa
  productId,
  rating: ratingValue,
  comment: comment || "",
});

// product.route.js — cùng interface
await reviewModel.createReview({
  reviewerId,
  revieweeId,
  productId: order.product_id,
  rating: ratingValue,
  comment: comment || null,
});
```

**Architectural improvement:**

- Module `review.model.js` là **anti-corruption layer**: nó biết DB column names (`reviewer_id`, `reviewee_id`), còn callers chỉ biết domain terms (`reviewerId`, `revieweeId`). Phân biệt này rõ ràng sau refactor — callers không bao giờ nhìn thấy `reviewee_id` hay `reviewed_user_id`.
- Caller không cần phân biệt `createReview` vs `create` — knowledge này thuộc về module nội bộ.

**Trade-off:** Sử dụng destructuring parameter thay vì positional parameters. Khi số lượng tham số lớn, destructuring rõ ràng hơn và ít lỗi hơn (không bị nhầm thứ tự).

---

## Issue #12 — Dual UPDATE API: `updateReview()` vs `updateByReviewerAndProduct()` (DRY + YAGNI)

### 1. Tìm kiếm vi phạm

**Nguyên tắc vi phạm:** DRY + YAGNI

**Hai hàm thực hiện cùng một UPDATE operation, khác ở WHERE clause:**

```javascript
// ——— Hàm 1: updateReview() — WHERE 3 columns (reviewer + reviewee + product) ———
export function updateReview(reviewer_id, reviewee_id, product_id, updateData) {
  return db("reviews")
    .where("reviewer_id", reviewer_id)
    .where("reviewee_id", reviewee_id) // ← tham số thừa
    .where("product_id", product_id)
    .update(updateData);
  // Caller (seller.route.js PUT /products/:id/rate) truyền 4 tham số
}

// ——— Hàm 2: updateByReviewerAndProduct() — WHERE 2 columns (reviewer + product) ———
export function updateByReviewerAndProduct(
  reviewer_id,
  product_id,
  updateData,
) {
  return db("reviews")
    .where("reviewer_id", reviewer_id)
    .where("product_id", product_id)
    .update(updateData);
  // Caller (product.route.js, account.route.js, seller.route.js) truyền 3 tham số
}
```

**Map các call sites thực tế:**

| File                                | Hàm gọi                                               | Số params | Ghi chú                           |
| ----------------------------------- | ----------------------------------------------------- | :-------: | --------------------------------- |
| `seller.route.js` (line 292)        | `updateReview(seller, bidder, product, data)`         |     4     | reviewee_id = `highest_bidder_id` |
| `seller.route.js` (line 254)        | `updateByReviewerAndProduct(seller, product, data)`   |     3     | —                                 |
| `product.route.js` (line 1230)      | `updateByReviewerAndProduct(reviewer, product, data)` |     3     | —                                 |
| `account.route.js` (lines 611, 643) | `updateByReviewerAndProduct(user, product, data)`     |     3     | —                                 |

**Tại sao đây là DRY + YAGNI violation (technical reasoning):**

- **DRY**: Cùng UPDATE logic được encode hai lần. Hai WHERE clauses chỉ khác nhau ở `reviewee_id` — nhưng trong bảng `reviews`, constraint business là **(reviewer_id, product_id) đã đủ unique**: một người chỉ có thể review một lần cho một sản phẩm. Do đó `reviewee_id` trong WHERE của `updateReview()` là **redundant predicate** — nó không thu hẹp result set, nhưng nếu truyền sai giá trị, UPDATE sẽ silently fail (0 rows) thay vì báo lỗi. Đây là loại bug đặc biệt nguy hiểm.

- **YAGNI**: `updateReview()` với 4 tham số được thiết kế cho trường hợp "cần specify reviewee để disambiguate" — nhưng constraint của domain (1 reviewer, 1 product, 1 review) làm cho điều này không bao giờ cần thiết. `reviewee_id` trong WHERE là feature "phòng ngừa" không có real use case → vi phạm YAGNI.

---

### 2. Đánh giá tác động

| Chiều tác động      | Hậu quả cụ thể                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Error-proneness** | `updateReview(seller, bidder, product, data)` truyền sai `bidder` (ví dụ: dùng `seller_id` cho cả hai) → UPDATE 0 rows, silently. Không có exception, không có log — bug không bị phát hiện.                                                                                                |
| **API clarity**     | Caller phải quyết định "dùng 3-param hay 4-param" — knowledge này không belong ở caller layer. `seller.route.js` thậm chí có cả hai hàm ở hai route khác nhau (`POST /rate` dùng `updateByReviewerAndProduct`, `PUT /rate` dùng `updateReview`) — không nhất quán ngay trong cùng một file. |
| **Maintainability** | Đổi UPDATE logic (ví dụ: thêm `updated_at`) → phải sửa cả hai hàm. Không có single point of change.                                                                                                                                                                                         |
| **Testability**     | Phải test cả hai code paths dù chúng produce identical DB behavior trong mọi valid use case.                                                                                                                                                                                                |
| **Coupling**        | 4-param version buộc caller phải biết `reviewee_id` của review — nhưng khi caller đã có `findByReviewerAndProduct()` trả về existing review, `reviewee_id` đã được encode trong WHERE của findBy — caller phải excavate thêm một field không cần thiết.                                     |

---

### 3. Đề xuất cải thiện

**Chiến lược:** Giữ lại 2-param version (đủ unique), xóa 4-param version, chuẩn hóa sang camelCase.

**Before:**

```javascript
// review.model.js — hai hàm UPDATE
export function updateReview(reviewer_id, reviewee_id, product_id, updateData) { ... }    // 4 params
export function updateByReviewerAndProduct(reviewer_id, product_id, updateData) { ... }   // 3 params

// seller.route.js (PUT /rate) — dùng 4-param version
await reviewModel.updateReview(sellerId, highest_bidder_id, productId, { ... });

// seller.route.js (POST /rate) — dùng 3-param version
await reviewModel.updateByReviewerAndProduct(sellerId, productId, { ... });

// ← Trong cùng một file, 2 route làm cùng việc dùng 2 hàm khác nhau
```

**After:**

```javascript
// review.model.js — một hàm UPDATE duy nhất, camelCase
export function updateReview(reviewerId, productId, updateData) {
  return db("reviews")
    .where("reviewer_id", reviewerId)
    .where("product_id", productId) // (reviewer, product) đã đủ unique
    .update(updateData);
}

// seller.route.js — cả hai route dùng cùng một hàm
// POST /rate:
await reviewModel.updateReview(sellerId, productId, {
  rating: ratingValue,
  comment,
});

// PUT /rate:
await reviewModel.updateReview(sellerId, productId, {
  rating: ratingValue,
  comment,
});
```

**Architectural improvement:** Hàm `updateReview()` sau refactor encode một invariant domain quan trọng: _a reviewer cannot have two reviews for the same product_. WHERE clause chỉ dùng `(reviewer_id, product_id)` là explicit statement của invariant này. Code trở thành documentation.

**Trade-off:** Bỏ `reviewee_id` khỏi WHERE giảm một layer của "safety" nếu có bad data trong DB. Tuy nhiên, constraint này đã được enforce ở tầng application (không bao giờ có 2 reviews từ cùng 1 reviewer cho 1 product), và có thể thêm DB unique constraint trên `(reviewer_id, product_id)` để enforce ở DB level thay vì WHERE condition.

---

## Kết nối giữa 2 Issues

```
Issue #11 (DRY + ISP)  → Dual INSERT API, field naming inconsistency
Issue #12 (DRY + YAGNI) → Dual UPDATE API, redundant parameter

Root cause chung: review.model.js không có một "contract" rõ ràng —
module grow organically với các hàm added khi cần mà không có API coherence review.
```

**Sự khác biệt quan trọng giữa #11 và #12:**

|                | Issue #11                                                    | Issue #12                                                     |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| Vấn đề cốt lõi | Hai caller dùng hai field name khác nhau cho CÙNG một column | Hai caller dùng hai WHERE clause khác nhau cho CÙNG operation |
| Loại vi phạm   | Knowledge duplication (naming)                               | Redundant predicate (tham số thừa)                            |
| Risk           | Silent null data nếu nhầm field                              | Silent UPDATE 0 rows nếu sai `reviewee_id`                    |
| Fix            | Merge thành 1 hàm, camelCase params                          | Merge thành 1 hàm, drop `reviewee_id` từ WHERE                |

---

## Bảng So Sánh Trước / Sau

| Metric              | Trước refactor                                           | Sau refactor                                        |
| ------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| Số hàm INSERT       | 2 (`createReview`, `create`)                             | 1 (`createReview`)                                  |
| Số hàm UPDATE       | 2 (`updateReview` 4-param, `updateByReviewerAndProduct`) | 1 (`updateReview` 2-param)                          |
| Field naming        | Mixed: `reviewee_id` / `reviewed_user_id`                | Unified camelCase: `revieweeId`                     |
| Caller knowledge    | Phải biết "field name nào cho hàm nào"                   | Chỉ cần biết camelCase domain names                 |
| Silent failure risk | `reviewed_user_id` → null nếu dùng nhầm hàm              | Không có — single path                              |
| UPDATE 0-row risk   | Cao (4-param version với sai `reviewee_id`)              | Thấp — WHERE chỉ dùng unique key                    |
| Call sites cần sửa  | —                                                        | 3 files: product.route, seller.route, account.route |

---

## Kết quả thực tế sau refactor

```
Trước:
review.model.js exports:
├── calculateRatingPoint(user_id)               ← giữ nguyên
├── getReviewsByUserId(user_id)                 ← giữ nguyên
├── getProductReview(reviewer, reviewee, prod)  ← giữ nguyên
├── findByReviewerAndProduct(reviewer, prod)    ← giữ nguyên
├── createReview(reviewData)                    ← [REPLACED] snake_case raw object
├── create(data)                                ← [DELETED]
├── updateReview(reviewer, reviewee, prod, data) ← [REPLACED] 4-param, snake_case
└── updateByReviewerAndProduct(reviewer, prod, data) ← [DELETED]

Sau:
review.model.js exports:
├── calculateRatingPoint(user_id)               ← unchanged
├── getReviewsByUserId(user_id)                 ← unchanged
├── getProductReview(reviewer, reviewee, prod)  ← unchanged
├── findByReviewerAndProduct(reviewer, prod)    ← unchanged
├── createReview({ reviewerId, revieweeId, productId, rating, comment }) ← NEW canonical
└── updateReview(reviewerId, productId, updateData)  ← NEW canonical
```

**Files đã sửa:**

- `auction-web/src/models/review.model.js` — module chính, thay mới 2 hàm, xóa 2 hàm cũ
- `auction-web/src/routes/product.route.js` — cập nhật 3 call sites
- `auction-web/src/routes/seller.route.js` — cập nhật 3 call sites
- `auction-web/src/routes/account.route.js` — cập nhật 3 call sites
