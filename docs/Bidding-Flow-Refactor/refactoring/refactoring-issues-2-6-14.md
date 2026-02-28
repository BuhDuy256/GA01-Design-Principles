# Phân Tích & Đề Xuất Refactoring — Issues #2, #6, #14

> Ba issues này cùng xuất phát từ một nguyên nhân gốc rễ: **không có nguồn sự thật duy nhất (single source of truth) cho auction state logic**. Fix chung là tạo module `auction-state.js` — giải quyết đồng thời cả DRY lẫn OCP.

---

## Issue #2 — Duplicate `productStatus` Logic (DRY)

### 1. Tìm kiếm vi phạm

**Nguyên tắc vi phạm:** DRY (Don't Repeat Yourself)

**Code vi phạm — xuất hiện nguyên vẹn tại 2 route:**

```javascript
// GET /detail  (product.route.js ~line 162)
const now = new Date();
const endDate = new Date(product.end_at);
let productStatus = "ACTIVE";

if (product.is_sold === true) productStatus = "SOLD";
else if (product.is_sold === false) productStatus = "CANCELLED";
else if ((endDate <= now || product.closed_at) && product.highest_bidder_id)
  productStatus = "PENDING";
else if (endDate <= now && !product.highest_bidder_id)
  productStatus = "EXPIRED";
else if (endDate > now && !product.closed_at) productStatus = "ACTIVE";

// GET /complete-order  (product.route.js ~line 984) — copy y chang, thiếu nhánh ACTIVE cuối
const now = new Date();
const endDate = new Date(product.end_at);
let productStatus = "ACTIVE";

if (product.is_sold === true) productStatus = "SOLD";
else if (product.is_sold === false) productStatus = "CANCELLED";
else if ((endDate <= now || product.closed_at) && product.highest_bidder_id)
  productStatus = "PENDING";
else if (endDate <= now && !product.highest_bidder_id)
  productStatus = "EXPIRED";
```

**Tại sao đây là DRY violation (technical reasoning):**

DRY không chỉ cấm copy-paste text — nó cấm encode cùng một **business rule** ở nhiều chỗ. Ở đây, rule
"auction ở trạng thái nào" là một invariant của domain:

- `is_sold = true` → SOLD
- `is_sold = false` → CANCELLED
- `hết hạn + có bidder` → PENDING
- `hết hạn + không có bidder` → EXPIRED
- còn lại → ACTIVE

Rule này được **encode hai lần** trong cùng một file, với một sự khác biệt nhỏ (nhánh `ACTIVE` cuối). Hai bản sao này là hai presentation của cùng một kiến thức — vi phạm DRY ở mức **knowledge duplication**, không chỉ code duplication.

---

### 2. Đánh giá tác động

| Chiều tác động      | Hậu quả cụ thể                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Maintainability** | Thêm state `DISPUTED` → phải sửa **cả hai chỗ**. Nếu quên một chỗ, hai route cho kết quả khác nhau với cùng một product.                                                |
| **Consistency**     | Hai bản copy đã **drift**: `GET /detail` có nhánh `else if (endDate > now && !product.closed_at)` mà `GET /complete-order` không có. Hành vi không nhất quán đã xảy ra. |
| **Testability**     | Muốn verify "auction PENDING được xác định đúng" phải viết test cho **cả hai** route handler với toàn bộ setup phức tạp của chúng. Không có unit testable function nào. |
| **Regression risk** | Sửa condition `(endDate <= now \|\| product.closed_at)` để thêm grace period → dễ bỏ sót một trong hai vị trí.                                                          |
| **Coupling**        | Business rule về state bị **gắn chặt** vào HTTP layer. Route handler vừa làm HTTP routing vừa làm domain classification — hai concern trộn lẫn.                         |

---

### 3. Đề xuất cải thiện

**Chiến lược:** Extract Function → move vào dedicated module.

**Before:**

```javascript
// Inline trong mỗi route handler — lặp lại
const now = new Date();
const endDate = new Date(product.end_at);
let productStatus = "ACTIVE";
if (product.is_sold === true) {
  productStatus = "SOLD";
} else if (product.is_sold === false) {
  productStatus = "CANCELLED";
} else if ((endDate <= now || product.closed_at) && product.highest_bidder_id) {
  productStatus = "PENDING";
} else if (endDate <= now && !product.highest_bidder_id) {
  productStatus = "EXPIRED";
}
// ...
```

**After:**

```javascript
// services/auction/auction-state.js — một nơi duy nhất
export function resolveAuctionStatus(product) {
  const now = new Date();
  const endDate = new Date(product.end_at);
  if (product.is_sold === true) return "SOLD";
  if (product.is_sold === false) return "CANCELLED";
  if ((endDate <= now || product.closed_at) && product.highest_bidder_id)
    return "PENDING";
  if (endDate <= now && !product.highest_bidder_id) return "EXPIRED";
  return "ACTIVE";
}

// Trong mỗi route handler — chỉ còn một dòng
import { resolveAuctionStatus } from "../services/auction/auction-state.js";
const productStatus = resolveAuctionStatus(product);
```

**Architectural improvement:** Business rule về state nằm ở **service layer**, không phải HTTP layer. Route handler trở thành pure orchestrator — nhận input, gọi service, trả response.

**Pattern áp dụng:** _Single Source of Truth_ — mọi caller (route, notifier, test) đều dùng cùng một hàm, không ai tự tính.

---

## Issue #6 — Auction State Logic Không Tập Trung (OCP)

### 1. Tìm kiếm vi phạm

**Nguyên tắc vi phạm:** OCP (Open/Closed Principle)

**Code vi phạm:**

Khối if/else 5 nhánh tồn tại **scattered** trong route handlers chứ không phải trong một module đóng gói. Đây không chỉ là vấn đề DRY — đây là vấn đề **extendability**:

```javascript
// Hiện tại: mỗi lần thêm state → phải tìm TẤT CẢ occurrence và sửa
if (product.is_sold === true)       → 'SOLD'
else if (product.is_sold === false) → 'CANCELLED'
else if (... && highest_bidder_id)  → 'PENDING'
else if (... && !highest_bidder_id) → 'EXPIRED'
else                                → 'ACTIVE'
// Nếu thêm 'PAUSED': phải sửa ở GET /detail, GET /complete-order, auctionEndNotifier...
```

**Tại sao đây là OCP violation (technical reasoning):**

OCP yêu cầu: **open for extension, closed for modification**. Vi phạm xảy ra khi:

1. **Trục mở rộng bị flatten thành if/else inline**: Mỗi state là một "variant" của khái niệm "trạng thái auction". Khi thêm variant mới (`PAUSED`, `DISPUTED`), lập trình viên phải **mở (modify) code hiện tại** thay vì **thêm (extend) code mới**.

2. **Không có abstraction ranh giới**: Vì logic nằm scattered trong handlers, không có "đơn vị đóng" nào để protect khỏi modification. `product.route.js` là high-level module nhưng lại **không closed** đối với thay đổi của state taxonomy.

3. **Guard conditions ≠ OCP violation, nhưng state classification = OCP violation**: `if (!product)` là guard — không phải trục mở rộng. Nhưng `if (product.is_sold === true) → 'SOLD'` là classification rule — đây là trục mở rộng domain, và nên được đóng gói.

---

### 2. Đánh giá tác động

| Chiều tác động            | Hậu quả cụ thể                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Extensibility**         | Thêm state `PAUSED` (ví dụ auction bị admin tạm dừng): phải tìm tất cả occurrence của khối if/else, sửa từng file, ensure consistency. Không có "nơi mở rộng" rõ ràng. |
| **Testability**           | Không thể viết unit test cho "state classification logic" vì nó không tồn tại như một unit riêng. Test phải đi qua HTTP handler.                                       |
| **Cognitive load**        | Developer muốn biết "auction có thể ở những state nào" phải grep toàn codebase thay vì đọc một module.                                                                 |
| **Risk of inconsistency** | Như đã thấy: `GET /detail` và `GET /complete-order` đã có sự khác biệt nhỏ trong implementation của cùng một logic — drift đã xảy ra.                                  |
| **Coupling**              | State classification rules bị coupled với HTTP routing concern — hai things that change for different reasons bị trộn lẫn.                                             |

---

### 3. Đề xuất cải thiện

**Chiến lược:** Extract Module + Encapsulate Variation (State Pattern lightweight)

**Before:**

```javascript
// Logic nằm rải rác — mỗi lần thêm state phải sửa nhiều file
// GET /detail:          if/else block (5 nhánh)
// GET /complete-order:  if/else block (4 nhánh, khác một chút)
// auctionEndNotifier:   if (auction.highest_bidder_id) { ... } else { ... }
// → 3 nơi, 3 cách viết khác nhau, không có boundary
```

**After:**

```javascript
// services/auction/auction-state.js — ĐÓNG với modifications, MỞ cho extension
export function resolveAuctionStatus(product) {
  const now = new Date();
  const endDate = new Date(product.end_at);

  // Terminal states — set explicitly bởi business logic
  if (product.is_sold === true) return "SOLD";
  if (product.is_sold === false) return "CANCELLED";

  // Auction đã kết thúc (hết hạn hoặc bị close sớm)
  const auctionEnded = endDate <= now || Boolean(product.closed_at);

  if (auctionEnded && product.highest_bidder_id) return "PENDING";
  if (auctionEnded && !product.highest_bidder_id) return "EXPIRED";

  return "ACTIVE";
}

// Thêm state PAUSED: CHỈ cần thêm điều kiện vào hàm này
// Không sửa bất kỳ route handler hay notifier nào.
```

**Guard functions — đóng gói access control logic:**

```javascript
// Tất cả access control rules cũng nằm trong auction-state.js
export const canBid = (status) => status === "ACTIVE";
export const canAccessOrder = (status) => status === "PENDING";
export const isTerminalState = (status) =>
  status === "SOLD" || status === "CANCELLED";
export const needsAccessCheck = (status) => status !== "ACTIVE";
```

**Pattern áp dụng:** _Encapsulate Variation_ — mọi variation của "state" nằm trong một module. Handler chỉ nhận kết quả, không biết logic bên trong.

---

## Issue #14 — `auctionEndNotifier.js` Tự Tính Lại State (DRY)

### 1. Tìm kiếm vi phạm

**Nguyên tắc vi phạm:** DRY — knowledge duplication ở cấp **cross-module**

**Code vi phạm trong `auctionEndNotifier.js` (line 27):**

```javascript
// auctionEndNotifier.js tự encode rule: "có bidder = PENDING, không có = EXPIRED"
if (auction.highest_bidder_id) {
  // → ngầm hiểu: auction ở PENDING state
  // gửi email cho winner và seller
} else {
  // → ngầm hiểu: auction ở EXPIRED state
  // gửi email cho seller only
}
```

**Tại sao đây là violation nghiêm trọng hơn mere code duplication:**

1. `auctionEndNotifier.js` là một module **độc lập**, chạy trong background process. Nó không import hay refer đến bất kỳ state logic nào từ route handlers.

2. Kết quả: trong hệ thống tồn tại **ba nguồn sự thật** cho cùng một business rule:
   - `GET /detail` → 5-nhánh if/else
   - `GET /complete-order` → 4-nhánh if/else (đã drift so với bản trên)
   - `auctionEndNotifier.js` → implicit `if (highest_bidder_id)` (2-nhánh, thiếu SOLD/CANCELLED check)

3. Notifier đang gởi email dựa trên implicit state check mà **không kiểm tra `is_sold`**: một product đã SOLD vẫn có `highest_bidder_id`, nếu `getNewlyEndedAuctions()` trả về nó thì notifier sẽ gửi "bạn đã thắng đấu giá" cho một product đã được giao dịch xong.

---

### 2. Đánh giá tác động

| Chiều tác động         | Hậu quả cụ thể                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Correctness risk**   | Notifier thiếu check `is_sold` — có thể gửi "congratulations" email sai cho SOLD/CANCELLED product nếu query trả về unexpected data.                                  |
| **Maintainability**    | Thay đổi `PENDING` condition (ví dụ thêm grace period 5 phút): phải sửa 3 nơi. Nếu quên notifier, email sẽ được gửi theo rule cũ trong khi route hiển thị state mới.  |
| **Cross-module drift** | Notifier và route đang "agree" ngẫu nhiên bởi vì hiện tại business rule đơn giản. Khi rule phức tạp hơn, agreement này có thể break mà không có compile-time warning. |
| **Testability**        | State logic của notifier không thể test độc lập — nó embedded trong email-sending function.                                                                           |
| **Observability**      | Khi bug xảy ra (user nhận email sai), không rõ rule nào trong 3 nơi gây ra lỗi — debugging phức tạp không cần thiết.                                                  |

---

### 3. Đề xuất cải thiện

**Chiến lược:** Centralize + Reference — notifier không tự tính state, mà nhờ `auction-state.js`.

**Before:**

```javascript
// auctionEndNotifier.js — implicit state check, 2 nhánh
for (const auction of endedAuctions) {
  if (auction.highest_bidder_id) {        // implicit: PENDING
    await sendMail(winner, ...);
    await sendMail(seller, ...);
  } else {                                 // implicit: EXPIRED
    await sendMail(seller, ...);
  }
  await productModel.markEndNotificationSent(auction.id);
}
```

**After:**

```javascript
// auctionEndNotifier.js — explicit state, dùng resolveAuctionStatus
import { resolveAuctionStatus } from "../services/auction/auction-state.js";

for (const auction of endedAuctions) {
  const status = resolveAuctionStatus(auction); // nguồn sự thật duy nhất

  if (status === "PENDING") {
    await notificationService.notifyAuctionWon(auction);
    await notificationService.notifySellerWinnerFound(auction);
  } else if (status === "EXPIRED") {
    await notificationService.notifySellerNoBidders(auction);
  }
  // status === 'SOLD'/'CANCELLED'/'ACTIVE' → không gửi email (handled elsewhere)

  await productModel.markEndNotificationSent(auction.id);
}
```

**Architectural improvement quan trọng:**

Việc thêm `is_sold` check vào `getNewlyEndedAuctions()` (DB query) chỉ là partial fix. Fix đúng là dùng `resolveAuctionStatus()` — vì nó capture **toàn bộ** business rule, không chỉ một condition. Nếu sau này `PENDING` được định nghĩa khác đi, notifier tự động cập nhật vì nó depend vào abstraction, không phải condition thô.

**Pattern áp dụng:** _Single Source of Truth_ + _Dependency on Abstraction_: notifier depend vào `resolveAuctionStatus` (abstraction của state logic), không depend vào raw DB fields.

---

## Kết nối giữa 3 Issues

Ba issues thực chất là **một vấn đề nhìn từ ba góc độ khác nhau**:

```
Issue #2 (DRY)   → Cùng code xuất hiện ở 2 route handlers
Issue #6 (OCP)   → Code đó không thể mở rộng vì không có boundary
Issue #14 (DRY)  → Code đó còn xuất hiện ở 1 module nữa (cross-file drift)

Fix duy nhất:    → Tạo auction-state.js, tất cả caller đều import từ đây
```

|                          | Trước refactor                                                 | Sau refactor                                            |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------- |
| Số nơi encode state rule | 3 (GET /detail, GET /complete-order, notifier)                 | 1 (`auction-state.js`)                                  |
| Thêm state mới           | Sửa 3+ file                                                    | Sửa 1 file                                              |
| Test state logic         | Không thể unit test                                            | `resolveAuctionStatus()` là pure function, test dễ dàng |
| State drift              | Đã xảy ra (GET /detail vs GET /complete-order có sự khác biệt) | Impossible — single source                              |

---

## Kết quả thực tế sau refactor

```
auction-web/src/
├── services/
│   └── auction/
│       └── auction-state.js        ← MỚI: single source of truth
├── routes/
│   └── product.route.js            ← import resolveAuctionStatus, xóa inline logic
└── scripts/
    └── auctionEndNotifier.js       ← import resolveAuctionStatus, xóa implicit check
```

`auction-state.js` là **pure module** — không import Express, không import DB, không có side effect. Đây là lý do nó dễ test và dễ reuse: mọi caller đều có thể dùng mà không cần thiết lập infrastructure.
