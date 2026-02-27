## Vi phạm YAGNI

`product.route.js` có một trường hợp dead code không bao giờ được thực thi.

### Dead code trong `GET /bid-history/:productId`

```js
router.get('/bid-history/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingHistoryModel.getBiddingHistory(productId);
    res.json({ success: true, data: history }); // ← response đã được gửi ở đây
  } catch (error) {
    res.status(500).json({ ... });
  }

  // ← Toàn bộ đoạn này KHÔNG BAO GIỜ chạy sau res.json() ở trên
  const result = await productModel.findByProductId(productId);
  const relatedProducts = await productModel.findRelatedProducts(productId);
  const product = { thumbnail: result[0].thumbnail, ... };
  res.render('vwProduct/details', { product }); // ← dead render
});
```

Sau khi `res.json()` được gọi trong `try` block, Node.js không throw error — nó vẫn tiếp tục chạy code phía dưới nhưng `productId` lúc này nằm ngoài scope của `try`, và `res.render()` sẽ gây lỗi **"Cannot set headers after they are sent"** nếu code này được kích hoạt bằng cách nào đó.

Đây là code cũ từ phiên bản render-based chưa được xóa khi chuyển sang JSON API.

### Đề xuất

Xóa toàn bộ phần dead code sau khối `try/catch`. Route chỉ cần:

```js
router.get("/bid-history/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingHistoryModel.getBiddingHistory(productId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error("Get bid history error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load bidding history" });
  }
});
```
