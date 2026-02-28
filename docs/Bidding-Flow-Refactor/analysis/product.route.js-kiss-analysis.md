## Vi phạm KISS

`product.route.js` vi phạm KISS khi nhồi nhiều concern vào một handler — không thể đọc hiểu trong vòng 30 giây.

### Route vi phạm nặng nhất: `POST /bid`

Một handler duy nhất thực hiện tuần tự 10 bước:

| Bước | Công việc                                                       |
| ---- | --------------------------------------------------------------- |
| 1    | Lock row DB để tránh race condition                             |
| 2–6  | Validate 5 điều kiện (sold, seller, rejected, rating, time)     |
| 7–8  | Validate bid amount và minimum increment                        |
| 9    | Check và apply auto-extend                                      |
| 10   | Chạy auto-bidding algorithm (3 case lồng nhau)                  |
| 11   | Check buy-now trigger                                           |
| 12   | Update DB (product + bidding_history + auto_bidding)            |
| 13   | Gửi 3 email song song (seller, current bidder, previous bidder) |
| 14   | Build response message (4 nhánh khác nhau)                      |
| 15   | Redirect với flash message                                      |

Kết quả: handler ~400 dòng, không thể test hay debug từng phần độc lập.

### Route vi phạm thứ hai: `GET /detail`

- Xác định `productStatus` (5 nhánh)
- Access control check
- Load 6 data sources song song
- Tính pagination comments
- Tính seller rating + bidder rating
- Build viewmodel lớn với 15+ fields

Tất cả trong một hàm, không có tên mô tả hành vi.

### Đề xuất

Mỗi bước trong `POST /bid` nên là một hàm có tên rõ ràng:

```
validateBidEligibility(product, userId, trx)
runAutoBidEngine(product, bidAmount, userId)
applyAutoExtend(product, settings, now)
notifyBidParticipants(result, productUrl)
buildBidResponseMessage(result)
```

Handler chỉ còn là orchestrator — gọi từng hàm theo thứ tự, dễ đọc và dễ test.
