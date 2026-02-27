## Vi phạm SRP

`product.route.js` đang xử lý nhiều domain cùng lúc — mỗi domain là một lý do độc lập để file thay đổi:

| Domain                    | Thay đổi khi                                                |
| ------------------------- | ----------------------------------------------------------- |
| HTTP layer                | Đổi format request/response, thêm middleware validate       |
| Bid validation & auto-bid | Đổi rule increment, thêm loại bid mới                       |
| Auction state machine     | Thêm state mới (PAUSED, DISPUTED), đổi điều kiện transition |
| DB access                 | Đổi ORM, đổi schema, tối ưu query                           |
| Email notification        | Đổi mail provider, đổi template, thêm loại notification     |
| Order creation            | Đổi flow thanh toán, thêm payment gateway                   |
| Watchlist                 | Thêm giới hạn, thêm notification watchlist                  |
| Rating & reputation       | Đổi cách tính điểm, thêm loại review                        |

### Đề xuất tách module

| Module                              | Trách nhiệm                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `routes/product.route.js`           | Nhận request → gọi service → trả response. Không chứa business logic.                       |
| `services/auction.service.js`       | Toàn bộ luồng `placeBid`: validate, auto-bid, state transition. Không biết Express tồn tại. |
| `services/bid-engine.js`            | Thuật toán auto-bid (Case 0 / Case 1 / else). Gọi từ `auction.service`.                     |
| `services/auction-state-machine.js` | `transition(state, event)`, `validateTransition()`. Tập trung state logic.                  |
| `services/notification.service.js`  | `notifyBidSuccess()`, `notifyOutbid()`, `notifyAuctionSold()`. Không coupled với domain.    |
| `services/order.service.js`         | `createOrderFromAuction()`. Tách Auction domain khỏi Order domain.                          |
| `services/rating.service.js`        | `createOrUpdateRating()`, `calculateReputation()`.                                          |

### Kết quả

- Mỗi module có đúng một lý do để thay đổi.
- Thay đổi email template không chạm vào bid logic.
- Thêm state mới chỉ sửa `auction-state-machine.js`.
- Giảm regression risk, dễ test độc lập.
