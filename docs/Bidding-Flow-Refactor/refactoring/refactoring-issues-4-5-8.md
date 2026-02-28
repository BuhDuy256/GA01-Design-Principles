# Refactoring — Issues #4, #5, #8: Core Bidding Logic Extraction

> **Step 4 of the incremental refactoring plan**  
> **Risk level:** Medium — architectural refactor, no DB schema change, no API contract change  
> **Files created:** `services/auction/bid-engine.js`, `services/auction/auction.service.js`  
> **Files modified:** `routes/product.route.js`

---

## 1. Problem Overview

Before this step, the entirety of the auction bidding flow — eligibility checks, the proxy-bidding algorithm, auto-extend logic, DB persistence, and email dispatch — lived inside two route handler functions:

- `router.post('/bid')` — **~430 lines**
- `router.post('/buy-now')` — **~100 lines**

Three distinct design principle violations were identified in these handlers.

---

## 2. Violated Principles

### Issue #4 — SRP + KISS: `POST /bid` as a God Handler (~430 lines)

| Concern       | Description                                                                       |
| ------------- | --------------------------------------------------------------------------------- |
| **Principle** | SRP, KISS                                                                         |
| **Location**  | `product.route.js` → `router.post('/bid')`                                        |
| **Violation** | A single async function performs 15 sequential steps with no named sub-operations |

The handler simultaneously:

1. Acquires a DB row lock (infrastructure)
2. Checks 5 eligibility conditions (domain rules)
3. Validates bid amount and increment (domain rules)
4. Fetches and applies system settings for auto-extend (domain + infrastructure)
5. Runs a 4-case proxy bidding algorithm (core business logic)
6. Decides whether buy-now price was reached (domain rule)
7. Writes to 3 DB tables inside a transaction (persistence)
8. Builds 3 different email HTML bodies (presentation)
9. Dispatches emails in parallel (async I/O)
10. Constructs a flash message from 4 branches (presentation)

**No step has a name.** A developer must read ~430 lines to understand what triggers what.

---

### Issue #5 — OCP: Inline Proxy-Bidding Algorithm

| Concern       | Description                                                                          |
| ------------- | ------------------------------------------------------------------------------------ |
| **Principle** | OCP                                                                                  |
| **Location**  | `product.route.js` → `router.post('/bid')` (auto-bidding section)                    |
| **Violation** | 4-case `if/else` for a strategy-like algorithm embedded directly in the HTTP handler |

The four cases (self-bid, first-bid, competitor lower, competitor higher) implement a proxy bidding strategy. If the business adds a new bid type (sealed bid, Dutch auction, reserve-price enforcement), the engineer must open the route handler and modify live production code — a direct violation of the Open/Closed Principle.

The algorithm had no name, no unit test surface, and no documentation of the invariants it enforces (e.g., first-come-first-served tie rule, buy-now protection rule).

---

### Issue #8 — DIP: Route Directly Depends on Concrete Infrastructure

| Concern       | Description                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| **Principle** | DIP                                                                                                         |
| **Location**  | `product.route.js` imports                                                                                  |
| **Violation** | High-level HTTP handler directly depends on `db` (Knex), `sendMail` (Nodemailer), and all model concretions |

The route actively calls `db.transaction()`, `trx('products').forUpdate()`, specific Knex query builder patterns, and Nodemailer transport — all concrete infrastructure. There is no abstraction between the HTTP layer and the data/notification layers.

**Consequence:** Unit-testing `POST /bid` is impossible without a real database. Replacing Knex with Prisma, or Nodemailer with SendGrid, requires modifying the route file directly.

---

## 3. Architectural Risk

| Risk Type                  | Description                                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Regression risk**        | A 430-line handler with 15 in-sequence steps has no isolated test surface. A change in auto-extend configuration can accidentally break the buy-now trigger — both are in the same undivided scope. |
| **Extensibility**          | Adding a new bid validation rule requires understanding the full 430-line context. The risk of introducing a logic error in an unrelated step is high.                                              |
| **Onboarding**             | A new developer cannot understand `POST /bid` without reading the entire function. No sub-problems are named or bounded.                                                                            |
| **Infrastructure lock-in** | Route tests require a live PostgreSQL container. No unit isolation.                                                                                                                                 |

---

## 4. Refactoring Strategy

The refactoring introduces a **two-layer separation** without over-engineering:

```
HTTP Layer (route)
      │  parse request
      │  call service
      │  send response
      ▼
Service Layer (auction.service.js)
      │  fetch required data
      │  call bid-engine (pure)
      │  persist result (transaction)
      │  dispatch emails (fire-and-forget)
      ▼
Domain Layer (bid-engine.js)
      │  pure functions, zero I/O
      │  validate eligibility
      │  validate amount
      │  compute auto-extend
      │  resolve proxy-bidding algorithm
      │  build response message
      ▼
Infrastructure (db, reviewModel, sendMail, ...)
```

**No new patterns introduced beyond this three-layer decomposition.** No DDD, no CQRS, no event bus. The goal is a surgically targeted improvement to testability and readability.

---

## 5. New File Structure

```
auction-web/src/
└── services/
    └── auction/
        ├── auction-state.js     ← Step 1 (Issues #2, #6, #14) — already exists
        ├── bid-engine.js        ← NEW (Issues #4, #5, #8)
        └── auction.service.js   ← NEW (Issues #4, #8)
```

### `bid-engine.js` — Pure Domain Functions

| Function                                    | Responsibility                                                  |
| ------------------------------------------- | --------------------------------------------------------------- |
| `validateBidEligibility(params)`            | Checks sold/seller/rejected/rating/time rules                   |
| `validateBuyNowEligibility(params)`         | Checks availability/seller/rating/buy-now-exists rules          |
| `validateBidAmount(price, bid, step)`       | Enforces minimum bid and increment                              |
| `computeAutoExtend(product, now, settings)` | Returns new end time or null                                    |
| `computeAutoBidResult(params)`              | **Core proxy-bidding algorithm** — 4 cases + buy-now protection |
| `buildBidResponseMessage(result)`           | Constructs user-facing flash message                            |

All functions are **deterministic and pure**: given the same inputs, they always return the same output with zero side effects. This makes them independently unit-testable.

### `auction.service.js` — Orchestration

| Function                                                  | Responsibility                         |
| --------------------------------------------------------- | -------------------------------------- |
| `placeBid({ productId, userId, bidAmount })`              | Runs full bid flow in a DB transaction |
| `executeBuyNow({ productId, userId })`                    | Runs buy-now flow in a DB transaction  |
| `sendBidNotifications({ result, productId, productUrl })` | Dispatches 3 emails in parallel        |

---

## 6. Before / After Comparison

### `POST /bid` Route Handler

**Before (~430 lines):**

```js
router.post('/bid', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = parseInt(req.body.productId);
  const bidAmount = parseFloat(req.body.bidAmount.replace(/,/g, ''));

  try {
    const result = await db.transaction(async (trx) => {
      const product = await trx('products').where('id', productId).forUpdate().first();
      // ... 5 eligibility checks ...
      // ... bid amount validation ...
      // ... auto-extend computation ...
      // ... 4-case auto-bidding algorithm ...
      // ... 3 DB writes ...
      return { ... };
    });

    // ... async email dispatch with inline HTML ...
    // ... 4-branch flash message builder ...
    req.session.success_message = baseMessage;
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) { ... }
});
```

**After (~22 lines):**

```js
router.post("/bid", isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = parseInt(req.body.productId);
  const bidAmount = parseFloat(req.body.bidAmount.replace(/,/g, ""));

  try {
    const result = await auctionService.placeBid({
      productId,
      userId,
      bidAmount,
    });
    const productUrl = `${req.protocol}://${req.get("host")}/products/detail?id=${productId}`;

    // Fire-and-forget: non-blocking email dispatch
    auctionService.sendBidNotifications({ result, productId, productUrl });

    req.session.success_message = buildBidResponseMessage({
      ...result,
      bidAmount,
    });
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    console.error("Bid error:", error);
    req.session.error_message =
      error.message || "An error occurred while placing bid. Please try again.";
    res.redirect(`/products/detail?id=${productId}`);
  }
});
```

### `POST /buy-now` Route Handler

**Before (~100 lines):** Inline DB transaction with 6 validation steps, 2 DB writes.  
**After (~20 lines):** `await auctionService.executeBuyNow({ productId, userId })`.

---

## 7. Summary Comparison Table

| Metric                                        | Before |      After      |
| --------------------------------------------- | :----: | :-------------: |
| `POST /bid` handler lines                     |  ~430  |  **22** (−95%)  |
| `POST /buy-now` handler lines                 |  ~100  |  **20** (−80%)  |
| Functions with named responsibilities         |   0    |      **8**      |
| Pure (unit-testable) domain functions         |   0    |      **6**      |
| Route depends on `db` (for bidding)           |  Yes   |     **No**      |
| Route depends on `sendMail` (for bidding)     |  Yes   |     **No**      |
| OCP: adding a bid case requires editing route |  Yes   |     **No**      |
| Auto-bid algorithm documented with invariants |   No   |     **Yes**     |
| `product.route.js` total lines                |  1828  | **1283** (−30%) |

---

## 8. Architectural Notes

### Why NOT a full Strategy Pattern (re: Issue #5)

The 4 auto-bid cases in `computeAutoBidResult()` are now documented as named invariants within a pure function. Introducing a full Strategy Pattern (polymorphic strategy objects) would be YAGNI at this scale — the cases are stable, well-bounded, and now unit-testable. If a genuinely new auction _type_ (sealed bid, Dutch auction) were introduced, the Strategy pattern becomes justified at that point.

### Why the email HTML stays in the service

Email body templates are a view concern, but they are tightly coupled to the bidding result structure. Moving them to a separate template file is a valid future step (Issue #7 in the violation table) but is out of scope here. The critical structural improvement is removing them from the HTTP handler — which is achieved.

### Route still imports `db` and `sendMail`

These imports remain because other routes in the same file (`POST /reject-bidder`, `POST /comment` etc.) use them directly. The bid/buy-now routes no longer use `db` or `sendMail` directly — the import is shared by other handlers, not by the refactored ones.

### Behavior invariant

External HTTP behavior is **identical** to before:

- Same HTTP status codes
- Same redirect targets
- Same flash message text (verified: `buildBidResponseMessage` outputs the same strings as the old `baseMessage` branches)
- Same email recipients, subjects, and HTML content
- Same DB writes in the same transaction boundaries
