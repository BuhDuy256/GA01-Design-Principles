## Target Architecture

Mục tiêu: tách `product.route.js` thành các module có boundary rõ ràng, loại bỏ coupling cao giữa bidding/order/rating.

---

### Cấu trúc thư mục sau refactor

```
auction-web/src/
├── routes/
│   ├── product.route.js        ← chỉ còn search, detail, category (discovery)
│   ├── bid.route.js            ← bid, buy-now, watchlist, reject-bidder
│   ├── order.route.js          ← complete-order, payment, shipping, chat
│   └── rating.route.js         ← submit-rating, seller/bidder rating pages
│
├── services/
│   ├── auction/
│   │   ├── auction-state.js    ← resolveStatus(), canBid(), canView()
│   │   ├── bid-engine.js       ← auto-bid algorithm (Case 0/1/2)
│   │   └── auction.service.js  ← orchestrate bid flow, gọi bid-engine
│   ├── order/
│   │   └── order.service.js    ← createOrderFromAuction(), lifecycle
│   ├── rating/
│   │   └── rating.service.js   ← createOrUpdateRating(), calculateReputation()
│   └── notification/
│       └── notification.service.js ← notifyBid(), notifyOutbid(), notifyOrder()
│
└── models/                     ← giữ nguyên, chỉ chuẩn hóa review.model.js
```

---

### Dependency graph sau refactor

```
routes/bid.route.js
    └── auction.service.js
            ├── bid-engine.js
            ├── auction-state.js
            ├── order.service.js       (gọi khi auction → PENDING)
            └── notification.service.js

routes/order.route.js
    └── order.service.js
            ├── rating.service.js      (check completion)
            └── notification.service.js

routes/product.route.js (discovery only)
    └── productModel (trực tiếp, OK vì chỉ read)
```

**Nguyên tắc:** route chỉ gọi service, service gọi model — không có route gọi model trực tiếp cho write operations.

---

### Thứ tự refactor an toàn

Thứ tự này đảm bảo mỗi bước không break code đang chạy:

| Bước | Việc làm                                                         | Lý do làm trước                                   |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------- |
| 1    | Tách `resolveAuctionStatus()` vào `auction-state.js`             | Giảm DRY ngay, risk thấp nhất, không đổi behavior |
| 2    | Chuẩn hóa `review.model.js` — bỏ dead methods                    | Risk thấp, không đổi caller nào                   |
| 3    | Tách `bid-engine.js` từ `POST /bid`                              | Tách thuật toán ra, giữ nguyên route interface    |
| 4    | Tạo `auction.service.js` bọc bid-engine + validation             | Route giờ chỉ gọi service                         |
| 5    | Tạo `order.service.js`, move order routes ra `order.route.js`    | Tách domain boundary                              |
| 6    | Tạo `notification.service.js`, gom email templates               | Giảm DRY email HTML                               |
| 7    | Tạo `rating.service.js`, move rating routes ra `rating.route.js` | Bước cuối, phụ thuộc order service                |

**Không làm song song bước 3-4 và 5** — bid-engine và order service có shared state tại thời điểm auction ends.

---

### Contracts giữa các module

#### auction.service → order.service

```js
// Khi auction kết thúc (buy-now hoặc bid trigger PENDING):
order.service.createOrderFromAuction({
  productId,
  buyerId,
  sellerId,
  finalPrice,
});
```

#### auction.service → notification.service

```js
notification.service.notifyBid({
  type: "new_bid" | "outbid" | "winning" | "sold",
  productId,
  sellerId,
  bidderId,
  previousBidderId,
  currentPrice,
  productUrl,
});
```

#### rating.service interface (sau chuẩn hóa)

```js
rating.service.upsertRating({
  reviewerId,
  revieweeId,
  productId,
  rating,
  comment,
});
rating.service.calculateReputation(userId);
```

---

### Những gì KHÔNG thay đổi

- DB schema — không đổi bất kỳ table nào
- Model files (trừ `review.model.js` cleanup nhỏ)
- View/Handlebars templates
- URL routes (path giữ nguyên, chỉ move vào file khác)
- `auctionEndNotifier.js` — chỉ thêm dùng `auction-state.js`
