## Vi phạm OCP

`product.route.js` chứa các khối if/else biểu diễn **trục mở rộng** của domain — mỗi lần thêm variant mới phải sửa trực tiếp code hiện tại.

### Các trục mở rộng bị vi phạm

| Trục                   | Biểu hiện                            | Vấn đề khi mở rộng                               |
| ---------------------- | ------------------------------------ | ------------------------------------------------ |
| Auto-bidding algorithm | Case 0 / Case 1 / else               | Thêm `sealed bid` → phải sửa khối logic hiện tại |
| Auction state          | 5-nhánh if/else theo `productStatus` | Thêm state `DISPUTED` → phải sửa nhiều chỗ       |
| Bid type               | normal / auto / buy-now              | Thêm loại bid mới → sửa cùng file ~400 dòng      |

### Phân biệt với if/else bình thường

OCP **không** áp dụng cho guard condition:

```js
if (product.is_sold) return error; // ← guard, không phải trục mở rộng
```

OCP chỉ liên quan khi if/else biểu diễn **nhiều chiến lược / state có hành vi khác nhau / biến thể domain độc lập**.

### Đề xuất

- Tách `bid-engine.js`: mỗi bid type là một strategy riêng → thêm loại bid mới chỉ thêm module.
- Tách `auction-state-machine.js`: tập trung state transition → thêm state mới không chạm core flow.

Khi thêm variant mới: **chỉ thêm module mới, không sửa logic core**.
