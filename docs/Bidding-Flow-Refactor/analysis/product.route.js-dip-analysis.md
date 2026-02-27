## Vi phạm DIP

`product.route.js` phụ thuộc trực tiếp vào concrete implementations — không có abstraction layer nào ở giữa.

### Các phụ thuộc cụ thể hiện tại

| Import                            | Loại                                      | Vấn đề khi thay đổi            |
| --------------------------------- | ----------------------------------------- | ------------------------------ |
| `../models/product.model.js`      | Concrete model (Knex/PostgreSQL)          | Đổi ORM hoặc DB → sửa route    |
| `../utils/mailer.js` (`sendMail`) | Concrete mail transport (Nodemailer/SMTP) | Đổi sang SendGrid → sửa route  |
| `../utils/db.js`                  | Concrete DB connection                    | Đổi DB engine → sửa route      |
| `../models/order.model.js`        | Concrete model                            | Đổi storage logic → sửa route  |
| `../models/review.model.js`       | Concrete model                            | Đổi rating storage → sửa route |

Route handler là **high-level module** (điều phối business flow) nhưng đang phụ thuộc vào **low-level modules** (storage, transport) — đây là vi phạm DIP cổ điển.

### Đề xuất

Thay vì import trực tiếp, route chỉ phụ thuộc vào **service abstractions**:

```
product.route.js
    ↓ depends on (interface/contract)
auction.service.js          ← không biết DB hay mail cụ thể
notification.service.js     ← không biết SMTP hay SendGrid
    ↓ depends on
mailer.js / db.js           ← concrete, chỉ ở tầng thấp nhất
```

| Tầng       | Module                          | Phụ thuộc vào                                   |
| ---------- | ------------------------------- | ----------------------------------------------- |
| High-level | `product.route.js`              | `auction.service`, `notification.service`       |
| Mid-level  | `auction.service.js`            | `IProductRepository`, `INotifier` (abstraction) |
| Low-level  | `product.model.js`, `mailer.js` | Implements abstraction trên                     |

### Kết quả

- Đổi mail provider: chỉ sửa `mailer.js`, không chạm route hay service.
- Đổi ORM: chỉ sửa model layer, không chạm business logic.
- Route và service có thể test độc lập bằng mock/stub.
