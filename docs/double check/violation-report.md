# Route Layer – Design Principle Violation Report

> **Scope:** All files under `src/routes/` (including `admin/` sub-folder)  
> **Format reference:** [Flow-01 Code Audit Report](../Flow-01/code-audit-report.md)

---

## 1. Violated Design Principles (SOLID, KISS, DRY, YAGNI)

### SOLID Violations

#### Single Responsibility Principle (SRP)

| File                             | Lines                                      | Violation                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/product.route.js`    | L1–L660 (660 lines)                        | A single route file handles **7+ distinct responsibilities**: product listing/search, product detail page, watchlist add/remove, bidding, commenting, bidder rejection/un-rejection with full transaction logic, buy-now flow, and bid history. Many of these are separate bounded contexts.          |
| `src/routes/product.route.js`    | L400–L594 (`POST /reject-bidder`)          | One Express handler (195 lines) performs seller ownership verification, auction status validation, bidder bid verification, database row locking, deletion from 3 tables, price recalculation across multiple cases, **and** constructs a raw HTML email template—all inline inside the route.        |
| `src/routes/product.route.js`    | L127–L254 (`GET /detail`)                  | The product detail handler loads data from **8 models** in parallel, performs authorization checks, paginates comments, loads replies (N+1 avoidance logic), calculates seller/bidder ratings, and determines UI button visibility—business orchestration that belongs in a service.                  |
| `src/routes/reputation.route.js` | L7–L85                                     | Mixes two unrelated concerns in one small file: (1) viewing a user's own reputation/ratings page, and (2) creating/updating seller reviews (`POST`/`PUT /won-auctions/:productId/rate-seller`). The rating mutation logic belongs in a review/rating service, not alongside the reputation dashboard. |
| `src/routes/seller.route.js`     | L1–L330                                    | Handles dashboard, CRUD for products, image uploads, product cancellation with review creation, bidder rating, description appending with notification dispatch, and description update CRUD. This mixes product management, review logic, and notification concerns.                                 |
| `src/routes/order.route.js`      | L48–L65 (`POST /:orderId/confirm-payment`) | Directly calls `invoiceModel.getPaymentInvoice`, `invoiceModel.verifyInvoice`, and `orderModel.updateStatus` sequentially — multi-step business logic that should be encapsulated in `orderService`, similar to how `processPaymentSubmission` is handled.                                            |
| `src/routes/admin/user.route.js` | L27–L50 (`POST /add`)                      | The route handler directly performs password hashing (`bcrypt.hash`) and constructs the full user data object instead of delegating to a service layer.                                                                                                                                               |

#### Open-Closed Principle (OCP)

| File                               | Lines                       | Violation                                                                                                                                                                                                             |
| ---------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/auth.route.js`         | L247–L285 (OAuth callbacks) | Each OAuth provider (Google, Facebook, GitHub) has an identical callback handler. Adding a new provider requires adding a new block of nearly identical code instead of configuring a generic OAuth callback handler. |
| `src/routes/admin/system.route.js` | L8–L12                      | `DEFAULT_SETTINGS` is hardcoded inline. Every time a new system setting is introduced, both the defaults object and the form/view must be modified—no extension point exists.                                         |

#### Dependency Inversion Principle (DIP)

| File                             | Lines          | Violation                                                                                                                                                                                                                             |
| -------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/product.route.js`    | L20, L410–L545 | Directly imports and uses `db` (Knex instance) to run raw `trx('products')`, `trx('auto_bidding')`, `trx('bidding_history')` queries inside the route handler. The route layer is now tightly coupled to the database implementation. |
| `src/routes/admin/user.route.js` | L2, L31        | Imports `bcryptjs` and calls `bcrypt.hash()` directly. The route depends on a low-level hashing library instead of going through a `UserService` or `AuthService`.                                                                    |
| `src/routes/product.route.js`    | L18, L555      | Directly imports and invokes `sendMail()` from `utils/mailer.js` to construct and send a raw HTML email. The route is coupled to the mail transport infrastructure.                                                                   |

---

### KISS (Keep It Simple, Stupid) Violations

| File                               | Lines                                | Violation                                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/product.route.js`      | L400–L594                            | The `POST /reject-bidder` handler is **195 lines** of nested transaction logic with 6 conditional branches for recalculating auction state. This should be a single call to an `auctionService.rejectBidder()` method.                          |
| `src/routes/product.route.js`      | L127–L254                            | The `GET /detail` handler performs 10+ async calls, multiple authorization branches, pagination math, N+1 query optimization, and rating loading—all inline. This level of orchestration makes the route handler extremely difficult to follow. |
| `src/routes/product.route.js`      | L548–L590                            | An entire styled HTML email template is embedded as a template literal inside the route handler, mixing presentation/email concerns with business logic.                                                                                        |
| `src/routes/order.route.js`        | L168–L200 (`GET /:orderId/messages`) | Inline date formatting (`toLocaleString`), message transformation (`isSent` computation), and partial Handlebars rendering. This view-transformation logic clutters the route.                                                                  |
| `src/routes/admin/system.route.js` | L38–L56 (`POST /settings`)           | The settings update duplicates the same "load settings → convert array to object" pattern as the GET handler, with additional logic to re-render on error.                                                                                      |

---

### DRY (Don't Repeat Yourself) Violations

| Pattern                                        | Files & Lines                                                                                                           | Description                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------- |
| **Pagination boilerplate**                     | `product.route.js` L48–L82 (`/category`) vs L106–L138 (`/search`) vs `bidding-activity.route.js` L11–L30 (`/watchlist`) | The exact same 10-line pagination calculation (`offset`, `nPages`, `from`, `to`, boundary clamping, `totalCount`) is copy-pasted **3 times** across different route handlers. Should be extracted to a `buildPagination(page, limit, totalCount)` utility.  |
| **Multer storage configuration**               | `admin/product.route.js` L94–L104 vs `utils/upload.js` L1–L13                                                           | `admin/product.route.js` redefines its own `multer.diskStorage` with **identical** destination and filename logic, instead of importing the shared `upload` utility from `utils/upload.js`.                                                                 |
| **Upload thumbnail/subimages endpoints**       | `seller.route.js` L99–L112 vs `admin/product.route.js` L106–L119                                                        | Two separate routes (`/products/upload-thumbnail` and `/products/upload-subimages`) have **identical** handler bodies in both the seller route and the admin product route.                                                                                 |
| **OAuth callback handler**                     | `auth.route.js` L253–L259 vs L267–L273 vs L281–L287                                                                     | Three OAuth callbacks (Google, Facebook, GitHub) contain the exact same 4-line session-setting logic: `req.session.authUser = req.user; req.session.isAuthenticated = true; res.redirect('/');`.                                                            |
| **Rating/review CRUD in routes**               | `reputation.route.js` L32–L85 vs `seller.route.js` L147–L177 vs `order.route.js` L117–L137                              | Review creation/update logic is scattered across **3 different route files**. Each file accesses `reviewModel` directly or via different service wrappers (`reviewService`, `orderService`) with slightly different patterns for the same domain operation. |
| **Error response pattern**                     | Nearly every handler in `product.route.js`, `order.route.js`, `seller.route.js`                                         | The pattern `catch (error) { console.error(...); res.status(X).json({ success: false, message: error.message                                                                                                                                                |     | '...' }); }` is repeated **15+ times** across route files with no shared error-handling middleware. |
| **`const sellerId = req.session.authUser.id`** | `seller.route.js` L12, L19, L26, L33, L50, L63, L81, L117, L155, L215, L247, L273, L306                                 | Extracted **13 times** in individual handlers. Could be set once via middleware (e.g., `res.locals.sellerId`).                                                                                                                                              |

---

### YAGNI (You Aren't Gonna Need It) Violations

| File                             | Lines        | Violation                                                                                                                                                       |
| -------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/product.route.js`    | L12–L13, L21 | Imports `invoiceModel` and `orderChatModel` but **never uses them** anywhere in the file. These are dead imports.                                               |
| `src/routes/product.route.js`    | L21          | Imports `parsePostgresArray` from `utils/dbHelpers.js` but **never uses it** in the file.                                                                       |
| `src/routes/auth.route.js`       | L2           | Imports `bcrypt` at the top of the file but **never calls any bcrypt function** directly. After refactoring to use `AuthService`, this import became dead code. |
| `src/routes/admin/user.route.js` | L4           | Imports `upgradeRequestModel` but **never uses it** anywhere. Dead import.                                                                                      |
| `src/routes/admin/user.route.js` | L6           | Imports `sendMail` from mailer utility but **never calls it** in any handler. Dead import.                                                                      |

---

## 2. God Route

### `src/routes/product.route.js` — 660 lines, 14 imports, 12+ route handlers

This is the clearest "God Route" in the codebase. It attempts to handle:

1. **Product listing** by category (`GET /category`)
2. **Product search** with full-text query support (`GET /search`)
3. **Product detail page** with authorization, pagination, and rating aggregation (`GET /detail`)
4. **Bidding history page** (`GET /bidding-history`)
5. **Watchlist management** — add and remove (`POST /watchlist`, `DELETE /watchlist`)
6. **Bidding** with notification dispatch (`POST /bid`)
7. **Comments** with nested reply handling and email notifications (`POST /comment`)
8. **Bid history API** (`GET /bid-history/:productId`)
9. **Bidder rejection** with full DB transaction and email (`POST /reject-bidder`)
10. **Bidder un-rejection** (`POST /unreject-bidder`)
11. **Buy-now purchase** (`POST /buy-now`)

The file imports **14 different modules**: 8 models (`product`, `review`, `user`, `watchList`, `biddingHistory`, `productComment`, `category`, `productDescriptionUpdate`, `systemSetting`, `rejectedBidder`, `invoice`, `orderChat`), 3 services (`auction-state`, `auction.service`, `bid-engine`), 2 utilities (`mailer`, `dbHelpers`), and the raw `db` (Knex) instance.

This violates SRP — product browsing, auction participation, seller moderation, and notification dispatch are all tangled together.

### `src/routes/seller.route.js` — 330 lines, 8 imports

A secondary God Route that blends:

1. Seller dashboard & product listing (active/pending/sold/expired)
2. Product creation with image uploads
3. Product cancellation with review creation
4. Bidder rating
5. Description CRUD with notification dispatch

---

## 3. High Coupling

### Route ↔ Database Coupling

| File                              | Evidence                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `product.route.js` L20, L410–L545 | Directly imports `db` (Knex) and runs raw transactional queries using `trx('products')`, `trx('auto_bidding')`, `trx('bidding_history')`, `trx('rejected_bidders')`, and `trx('users')`. The route layer is tightly bound to the table schema and query builder syntax. Any database schema change forces route-level modifications. |
| `order.route.js` L48–L65          | `POST /:orderId/confirm-payment` directly orchestrates `invoiceModel.getPaymentInvoice()` → `invoiceModel.verifyInvoice()` → `orderModel.updateStatus()`. The route knows the exact sequence of model calls needed, coupling it to the data layer ordering.                                                                          |

### Route ↔ Infrastructure Coupling

| File                              | Evidence                                                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product.route.js` L18, L555–L590 | Directly imports `sendMail` and constructs an inline styled HTML email template (35 lines of HTML). Any change to email format, provider, or template requires editing the Express route file. |
| `admin/user.route.js` L2, L31     | Directly imports `bcryptjs` and calls `bcrypt.hash(password, 10)`. The hashing algorithm and salt rounds are hardcoded in the presentation layer.                                              |
| `auth.route.js` L15, L46          | Reads `process.env.RECAPTCHA_SITE_KEY` and `process.env.APP_BASE_URL` directly, coupling routes to specific environment variable names.                                                        |
| `admin/product.route.js` L94–L104 | Redefines its own `multer.diskStorage` configuration inline instead of using the shared `utils/upload.js`, creating a second point of coupling to the filesystem layout.                       |

### Route ↔ View Coupling

| File                                | Evidence                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product.route.js` L127–L254        | The `GET /detail` handler computes **16 separate view variables** (product, productStatus, authUser, descriptionUpdates, biddingHistory, rejectedBidders, comments, success/error messages, related products, seller/bidder rating points, has_reviews flags, pagination, showPaymentButton). The route is intimately aware of what the Handlebars template expects. |
| `order.route.js` L168–L200          | Performs inline date formatting and message transformation (`isSent`, `formattedDate`), then renders a Handlebars partial to an HTML string—mixing data transformation with template rendering.                                                                                                                                                                      |
| `bidding-activity.route.js` L49–L60 | The route handler iterates over `wonAuctions`, queries `reviewModel` for each product, and manually attaches `has_rated_seller`, `seller_rating`, and `seller_rating_comment` properties. This presentation-layer enrichment logic belongs in a service or view-model layer.                                                                                         |

### Cross-Route Coupling (Shared Domain Logic Scattered)

The **review/rating** domain is spread across **4 route files** with inconsistent access patterns:

| Route File            | How it accesses reviews                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reputation.route.js` | Directly calls `reviewModel.create()`, `reviewModel.findByReviewerAndProduct()`, `reviewModel.updateByReviewerAndProduct()`, `reviewModel.calculateRatingPoint()`      |
| `seller.route.js`     | Uses `reviewService.upsertProductRating()` and `reviewService.enrichProductsWithReviews()`, but also directly calls `reviewModel.createReview()` in the cancel handler |
| `product.route.js`    | Calls `reviewModel.calculateRatingPoint()` and `reviewModel.getReviewsByUserId()` inline                                                                               |
| `order.route.js`      | Delegates to `orderService.submitRating()` and `orderService.skipRating()`                                                                                             |

This means a change to the review domain model requires scanning **4 separate route files** plus their respective services.

---

## 4. Summary Table

| Principle         | # Violations  | Most Critical File                                                                                                  |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| **SRP**           | 7             | `product.route.js` — 660-line God Route mixing 7+ concerns                                                          |
| **OCP**           | 2             | `auth.route.js` — hardcoded OAuth provider blocks                                                                   |
| **DIP**           | 3             | `product.route.js` — raw Knex transactions in route layer                                                           |
| **KISS**          | 5             | `product.route.js` — 195-line reject-bidder handler                                                                 |
| **DRY**           | 7 patterns    | Pagination boilerplate (3×), multer config (2×), upload endpoints (2×), OAuth callbacks (3×), error handling (15+×) |
| **YAGNI**         | 5             | `product.route.js` — 3 unused imports; `auth.route.js` — unused bcrypt; `admin/user.route.js` — 2 unused imports    |
| **God Route**     | 2             | `product.route.js` (660 lines, 12+ handlers), `seller.route.js` (330 lines)                                         |
| **High Coupling** | 10+ instances | Route ↔ DB, Route ↔ Infrastructure, Route ↔ View, Cross-route domain scatter                                        |
