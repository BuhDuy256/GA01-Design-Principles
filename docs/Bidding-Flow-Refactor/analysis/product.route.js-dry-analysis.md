## Vi phạm DRY

`product.route.js` có hai vị trí lặp logic rõ ràng.

### 1. Logic xác định `productStatus` bị duplicate

Cùng một khối 5-nhánh if/else xuất hiện nguyên vẹn ở **2 route khác nhau**:

`GET /detail` và `GET /complete-order`:

```js
if (product.is_sold === true)              productStatus = 'SOLD';
else if (product.is_sold === false)        productStatus = 'CANCELLED';
else if ((...) && product.highest_bidder_id) productStatus = 'PENDING';
else if (endDate <= now && !product.highest_bidder_id) productStatus = 'EXPIRED';
else                                       productStatus = 'ACTIVE';
```

Vấn đề: khi thêm state mới (ví dụ: `DISPUTED`), phải sửa **cả hai chỗ**. Dễ quên, dễ lệch nhau.

**Fix:** Tách thành một hàm dùng chung:

```js
function resolveAuctionStatus(product) { ... }
```

---

### 2. Email template layout lặp cấu trúc

3 email trong `POST /bid` (seller / current bidder / previous bidder) đều dùng cùng một layout:

```html
<div style="font-family: Arial...max-width: 600px...">
  <div style="background: linear-gradient(...)">
    ← header
    <div style="background-color: #f8f9fa...">
      ← body
      <p style="color: #888; font-size: 12px...">← footer</p>
    </div>
  </div>
</div>
```

Mỗi email viết lại toàn bộ HTML thay vì chỉ thay phần nội dung khác nhau.

**Fix:** Tách template builder dùng chung:

```js
function buildEmailLayout({ headerColor, title, bodyHtml }) { ... }
```

---

### Tóm lại

| Vi phạm               | Vị trí                               | Hậu quả                |
| --------------------- | ------------------------------------ | ---------------------- |
| `productStatus` logic | `GET /detail`, `GET /complete-order` | Thêm state → sửa 2 chỗ |
| Email HTML layout     | 3 email trong `POST /bid`            | Đổi layout → sửa 3 chỗ |
