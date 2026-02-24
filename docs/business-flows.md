==============================
BUSINESS FLOWS
==============================

System Dependency Map (cross-flow baseline)

- Entry point: `auction-web/src/index.js`.
- Route mounts:
  - `/` -> `home.route.js`
  - `/products` -> `product.route.js`
  - `/account` -> `account.route.js`
  - `/seller` -> `seller.route.js` (guarded by `isAuthenticated + isSeller`)
  - `/admin/*` -> admin routes (guarded by `isAdmin`)
- Background process: `scripts/auctionEndNotifier.js` started from `index.js`.
- Shared middleware/util baseline:
  - Auth guards: `middlewares/auth.mdw.js`
  - DB connector: `utils/db.js`
  - Mail delivery: `utils/mailer.js`
  - OAuth setup: `utils/passport.js`

FLOW 1 – Identity, Authentication & Account Recovery

Purpose:

- Register/sign in users, verify email, reset passwords, maintain authenticated session, and support OAuth login.

Entry Points:

- `/account/signup`, `/account/signin`, `/account/logout`
- `/account/verify-email`, `/account/resend-otp`
- `/account/forgot-password`, `/account/verify-forgot-password-otp`, `/account/reset-password`
- `/account/auth/google`, `/account/auth/facebook`, `/account/auth/github` (+ callbacks)

Files Owned:

- `auction-web/src/routes/account.route.js` (primary)
- `auction-web/src/utils/passport.js` (primary)
- `auction-web/src/models/user.model.js` (primary)

Internal Dependency Chain:

- `account.route.js` -> `passport.js` / `user.model.js` -> `mailer.js` / session (`express-session` via `index.js`)

FLOW 2 – Buyer Discovery, Watchlist & Auction Participation

Purpose:

- Let bidders discover products, inspect details, place bids (including auto-bid behavior), manage watchlist, and execute buy-now.

Entry Points:

- `/`, `/products/category`, `/products/search`, `/products/detail`
- `/products/watchlist` (POST/DELETE)
- `/products/bid`, `/products/bid-history/:productId`
- `/products/reject-bidder`, `/products/unreject-bidder`
- `/products/buy-now`

Files Owned:

- `auction-web/src/routes/home.route.js` (primary)
- `auction-web/src/routes/product.route.js` (primary for bid/discovery/moderation segment)
- `auction-web/src/models/product.model.js` (primary)
- `auction-web/src/models/biddingHistory.model.js` (primary)
- `auction-web/src/models/autoBidding.model.js` (primary)
- `auction-web/src/models/watchlist.model.js` (primary)
- `auction-web/src/models/rejectedBidder.model.js` (primary)
- `auction-web/src/models/category.model.js` (primary)
- `auction-web/src/models/systemSetting.model.js` (primary for bid-timer controls)

Internal Dependency Chain:

- `home.route.js`/`product.route.js` -> bid/discovery logic in route handlers + transactions (`db.js`) -> auction models (`product`, `biddingHistory`, `autoBidding`, `rejectedBidder`, `watchlist`, `category`, `systemSetting`) -> optional notifications (`mailer.js`)

FLOW 3 – Seller Auction Operations

Purpose:

- Enable sellers to create/manage listings, upload images, monitor product lifecycle (active/pending/sold/expired), cancel auctions, and rate bidders.

Entry Points:

- `/seller`, `/seller/products/*`
- `/seller/products/add`, `/seller/products/upload-thumbnail`, `/seller/products/upload-subimages`
- `/seller/products/:id/cancel`
- `/seller/products/:id/rate` (POST/PUT)

Files Owned:

- `auction-web/src/routes/seller.route.js` (primary)

Internal Dependency Chain:

- `seller.route.js` -> seller business logic in route handlers -> `product.model.js` + `review.model.js` -> file system (`fs`), upload (`multer`), optional email (`mailer.js`)

FLOW 4 – Product Communication & Description Updates

Purpose:

- Handle buyer/seller Q&A comments and seller description updates with stakeholder notifications.

Entry Points:

- `/products/comment`
- `/seller/products/:id/append-description`
- `/seller/products/:id/description-updates`
- `/seller/products/description-updates/:updateId` (PUT/DELETE)

Files Owned:

- `auction-web/src/models/productComment.model.js` (primary)
- `auction-web/src/models/productDescriptionUpdate.model.js` (primary)

Internal Dependency Chain:

- `product.route.js` / `seller.route.js` -> communication/update logic in route handlers -> `productComment.model.js` / `productDescriptionUpdate.model.js` + bidder/commenter lookups (`biddingHistory.model.js`) -> `mailer.js`

FLOW 5 – Order Fulfillment, Payment, Shipping, Completion & Chat

Purpose:

- Convert winning auction to order, collect payment proofs, confirm payment/shipping/delivery, finalize transaction via bilateral rating/skip, and support order chat.

Entry Points:

- `/products/complete-order`
- `/products/order/upload-images`
- `/products/order/:orderId/submit-payment`
- `/products/order/:orderId/confirm-payment`
- `/products/order/:orderId/submit-shipping`
- `/products/order/:orderId/confirm-delivery`
- `/products/order/:orderId/submit-rating`
- `/products/order/:orderId/complete-transaction`
- `/products/order/:orderId/send-message`
- `/products/order/:orderId/messages`

Files Owned:

- `auction-web/src/models/order.model.js` (primary)
- `auction-web/src/models/invoice.model.js` (primary)
- `auction-web/src/models/orderChat.model.js` (primary)

Internal Dependency Chain:

- `product.route.js` -> order orchestration logic -> `order.model.js` + `invoice.model.js` + `orderChat.model.js` + `review.model.js` -> `db.js` (product sold finalization)

FLOW 6 – Reputation & Rating Views

Purpose:

- Compute and expose seller/bidder reputation for decision-making and post-transaction trust.

Entry Points:

- `/account/ratings`
- `/products/seller/:sellerId/ratings`
- `/products/bidder/:bidderId/ratings`
- Embedded rating actions in seller/account/order flows

Files Owned:

- `auction-web/src/models/review.model.js` (primary)

Internal Dependency Chain:

- `account.route.js` / `product.route.js` / `seller.route.js` -> reputation logic in route handlers -> `review.model.js` (+ `user.model.js` for identity display)

FLOW 7 – Upgrade Lifecycle (Bidder -> Seller)

Purpose:

- Capture bidder upgrade requests and complete approval/rejection workflow.

Entry Points:

- `/account/request-upgrade` (GET/POST)
- `/admin/users/upgrade-requests`
- `/admin/users/upgrade/approve`
- `/admin/users/upgrade/reject`

Files Owned:

- `auction-web/src/models/upgradeRequest.model.js` (primary)

Internal Dependency Chain:

- `account.route.js` / `admin/user.route.js` -> upgrade workflow logic -> `upgradeRequest.model.js` + `user.model.js` (role mutation)

FLOW 8 – Administration Governance (Users, Categories, Products, System Settings)

Purpose:

- Central governance for platform data and operational knobs under admin authorization.

Entry Points:

- `/admin/users/*`
- `/admin/categories/*`
- `/admin/products/*`
- `/admin/system/settings`
- `/admin/account/profile`

Files Owned:

- `auction-web/src/routes/admin/user.route.js` (primary)
- `auction-web/src/routes/admin/category.route.js` (primary)
- `auction-web/src/routes/admin/product.route.js` (primary)
- `auction-web/src/routes/admin/system.route.js` (primary)
- `auction-web/src/routes/admin/account.route.js` (primary)

Internal Dependency Chain:

- admin routes -> admin logic in route handlers -> governed models (`user`, `category`, `product`, `systemSetting`, `upgradeRequest`) -> optional `mailer.js`

FLOW 9 – Auction End Notification Automation

Purpose:

- Detect newly ended auctions and send outcome-specific emails to winners/sellers.

Entry Points:

- Startup hook in `index.js` calling `startAuctionEndNotifier(30)`.

Files Owned:

- `auction-web/src/scripts/auctionEndNotifier.js` (primary)

Internal Dependency Chain:

- `index.js` scheduler trigger -> `auctionEndNotifier.js` -> `product.model.js` (`getNewlyEndedAuctions`, `markEndNotificationSent`) -> `mailer.js`

Cross-Flow Shared Core (unavoidable infrastructure)

- `auction-web/src/index.js` -> SHARED (routing composition, session, auth bootstrap, global locals)
- `auction-web/src/middlewares/auth.mdw.js` -> SHARED (role/auth gates)
- `auction-web/src/utils/db.js` -> SHARED (database access)
- `auction-web/src/utils/mailer.js` -> SHARED (outbound notifications)

==============================
OVERLAPPING ANALYSIS
==============================

1. Files involved:

- `routes/product.route.js`, `routes/seller.route.js`, `models/review.model.js`
  Flows involved:
- Seller Auction Operations, Order Fulfillment, Reputation & Rating
  Type of overlap:
- Shared model + Mixed responsibility
  Risk Level:
- High
  Why problematic:
- Rating logic is spread across multiple route files with different create/update paths (`create`, `createReview`, `updateReview`, `updateByReviewerAndProduct`), making behavior drift likely during refactoring.

2. Files involved:

- `routes/product.route.js` (single very large module), `models/product.model.js`, `models/order.model.js`, `models/invoice.model.js`, `models/orderChat.model.js`
  Flows involved:
- Buyer Discovery/Bidding, Order Fulfillment, Communication
  Type of overlap:
- Mixed responsibility + Cross-calling inside one route module
  Risk Level:
- High
  Why problematic:
- One route file orchestrates unrelated business stages (search, bid engine, payment, shipping, chat), increasing regression blast radius and making independent changes difficult.

3. Files involved:

- `models/product.model.js`
  Flows involved:
- Buyer Discovery/Bidding, Seller Operations, Admin Governance, Notification Automation
  Type of overlap:
- Shared model
  Risk Level:
- High
  Why problematic:
- `product.model.js` combines read models, admin CRUD, seller dashboards, and notifier queries. Changes for one use case can unintentionally affect others.

4. Files involved:

- `utils/mailer.js` + call sites in `account.route.js`, `product.route.js`, `seller.route.js`, `admin/user.route.js`, `scripts/auctionEndNotifier.js`
  Flows involved:
- Identity, Buyer/Seller interactions, Admin, Automation
  Type of overlap:
- Shared service
  Risk Level:
- Medium
  Why problematic:
- Notification templates and timing are embedded in route handlers/scripts, so mail policy changes require touching many flows and increase inconsistency risk.

5. Files involved:

- `models/user.model.js` used by `account.route.js`, `admin/user.route.js`, `utils/passport.js`, `product.route.js`, `index.js`
  Flows involved:
- Identity, Admin Governance, Reputation display, Upgrade lifecycle
  Type of overlap:
- Shared model
  Risk Level:
- Medium
  Why problematic:
- User lifecycle, auth identity, and admin management are tightly intertwined; schema or role change can ripple across nearly all flows.

6. Files involved:

- `models/systemSetting.model.js` in `admin/system.route.js` and bid logic inside `product.route.js`
  Flows involved:
- Administration Governance, Buyer Bidding
  Type of overlap:
- Cross-flow config dependency
  Risk Level:
- Medium
  Why problematic:
- Runtime bid behavior depends on settings edited by admin; insufficient validation/versioning can destabilize auction timing logic.

==============================
SHARED COMPONENTS
==============================

1. File name:

- `auction-web/src/index.js`
  Type:
- Application composition / bootstrapping
  Used by which flows:
- All flows
  Should it remain shared?
- Yes
  Suggested refactoring strategy:
- Keep only wiring (mount/compose). Move global business hooks (e.g., category preload decisions) into explicit middleware modules by flow intent.

2. File name:

- `auction-web/src/utils/db.js`
  Type:
- Utility (DB access)
  Used by which flows:
- All data-mutating and query flows
  Should it remain shared?
- Yes
  Suggested refactoring strategy:
- Keep shared; enforce transaction boundaries in dedicated domain services instead of route handlers.

3. File name:

- `auction-web/src/utils/mailer.js`
  Type:
- Utility (notification transport)
  Used by which flows:
- Identity, Buyer/Seller interactions, Admin, Automation
  Should it remain shared?
- Yes
  Suggested refactoring strategy:
- Introduce domain notification adapters (AuthMailer, AuctionMailer, OrderMailer) to centralize templates and reduce duplicated inline HTML.

4. File name:

- `auction-web/src/middlewares/auth.mdw.js`
  Type:
- Middleware
  Used by which flows:
- Seller, Admin, protected account/product actions
  Should it remain shared?
- Yes
  Suggested refactoring strategy:
- Keep shared; add explicit guards for nullable `authUser` and role policy map to avoid duplicated checks.

5. File name:

- `auction-web/src/models/product.model.js`
  Type:
- Model
  Used by which flows:
- Discovery/Bidding, Seller Ops, Admin Governance, Notification Automation
  Should it remain shared?
- No (as a single monolith)
  Suggested refactoring strategy:
- Split by domain intent: `productReadModel`, `auctionStateModel`, `sellerPortfolioModel`, `adminProductModel`, `auctionNotifierModel`.

6. File name:

- `auction-web/src/models/user.model.js`
  Type:
- Model
  Used by which flows:
- Identity, Admin, Upgrade, Reputation
  Should it remain shared?
- Yes (with boundaries)
  Suggested refactoring strategy:
- Keep one source of truth but expose narrower domain interfaces (auth identity, admin user management, role transition).

7. File name:

- `auction-web/src/models/review.model.js`
  Type:
- Model
  Used by which flows:
- Seller Ops, Account ratings, Order completion, Product rating pages
  Should it remain shared?
- Yes
  Suggested refactoring strategy:
- Normalize API to one create/update pathway and one naming convention to eliminate semantic duplication.

8. File name:

- `auction-web/src/models/systemSetting.model.js`
  Type:
- Model
  Used by which flows:
- Admin Settings, Bidding behavior
  Should it remain shared?
- Yes
  Suggested refactoring strategy:
- Add validated config service and cache/versioning strategy to avoid invalid runtime values in auction logic.

==============================
COUPLING SUMMARY
==============================

Overall coupling level:

- High

Most tightly coupled flows:

- Buyer Discovery/Bidding <-> Order Fulfillment <-> Reputation
- Seller Auction Operations <-> Product Communication
- Admin Governance <-> Upgrade Lifecycle

Most complex flow:

- Buyer Discovery, Watchlist & Auction Participation (especially `product.route.js` bidding + moderation + transitions).

Flows that can be assigned independently to different developers:

- Identity/Auth (FLOW 1)
- Upgrade Lifecycle (FLOW 7)
- Admin Governance UI/actions (FLOW 8, except shared user/product model changes)
- Notification Automation (FLOW 9, if product state contracts stay stable)

Shared components that should be refactored first:

1. `routes/product.route.js` (split by subflow: discovery/bid/order/chat/moderation)
2. `models/product.model.js` (split into bounded model modules)
3. `models/review.model.js` API normalization
4. Notification extraction from route handlers into flow-specific mail services

Refactoring risk notes:

- Highest risk is changing auction state transitions (`ACTIVE/PENDING/SOLD/CANCELLED/EXPIRED`) because multiple flows infer status independently.
- Secondary risk is duplicated rating write paths causing inconsistent completion logic for orders.
