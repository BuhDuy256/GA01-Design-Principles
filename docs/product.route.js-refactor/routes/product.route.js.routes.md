🔹 GET Routes

GET /category

GET /search

GET /detail

GET /bidding-history (requires isAuthenticated)

GET /complete-order (requires isAuthenticated)

GET /bid-history/:productId

GET /seller/:sellerId/ratings

GET /bidder/:bidderId/ratings

🔹 POST Routes

POST /watchlist (requires isAuthenticated)

POST /bid (requires isAuthenticated)

POST /comment (requires isAuthenticated)

POST /reject-bidder (requires isAuthenticated)

POST /unreject-bidder (requires isAuthenticated)

POST /buy-now (requires isAuthenticated)

🔹 DELETE Routes

DELETE /watchlist (requires isAuthenticated)
