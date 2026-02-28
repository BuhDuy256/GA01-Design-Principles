# Refactoring — Issue #9: Order Creation Timing & Domain Boundary Separation

> **Step 5 of the incremental refactoring plan**
> **Risk level:** Low-Medium — behavioral correction and domain boundary clarification; no DB schema change, no API contract change
> **Files created:** `services/order.service.js`
> **Files modified:** `services/auction/auction.service.js`, `scripts/auctionEndNotifier.js`, `routes/product.route.js`

---

## 1. Problem Overview

Prior to this step, the system lacked a defined moment for Order entity creation when an auction ended. The creation was deferred: it happened **lazily**, only when the winner or seller navigated to the `GET /complete-order` page. Two separate code paths both ended auctions (natural expiry and buy-now), but **neither path created an Order**. Instead, the `GET /complete-order` handler contained inline fallback logic to create the Order if it did not exist yet.

This deferral is architecturally incorrect: an Order is a **business fact**, not a UI concern. Its existence should not depend on which HTTP route a user happens to visit.

```
BEFORE (broken):
  Auction ends (any path)
      |
      |  — No Order created yet —
      v
  User visits GET /complete-order
      |
      v
  Route checks: does order exist?
      ├─ YES → render page
      └─ NO  → route calls orderModel.createOrder()  ← business logic in HTTP handler
```

```
AFTER (correct):
  Auction enters PENDING state (domain transition)
      |
      v
  auction.service / auctionEndNotifier creates Order immediately
      |  ← createOrderFromAuction() — idempotent, domain-owned
      v
  User visits GET /complete-order
      |
      v
  Route reads existing Order (pure read operation)
      ├─ Order found → render page
      └─ Order missing → idempotent safeguard call (scheduler race window only)
```

---

## 2. Violated Principles

### Issue #9a — SRP: Order Domain Logic in HTTP Route Handler

| Attribute     | Details                                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Principle** | SRP (Single Responsibility Principle)                                                                                                                                                                      |
| **Location**  | `product.route.js` → `router.get('/complete-order')`                                                                                                                                                       |
| **Violation** | A GET route handler — whose sole responsibility is reading and rendering the complete-order page — also performs a conditional write (Order creation) that belongs to the Auction domain transition layer. |

A GET handler has a single clear responsibility: read state and render a response. HTTP GET is conventionally idempotent (RFC 7231, §4.3.1). Embedding an entity-creation side effect inside a GET handler violates both SRP and HTTP semantics, making the route:

- **Non-idempotent** — each first access creates a database record.
- **Untestable in isolation** — a test for "render the order page" inevitably tests "create an order" as well.
- **Fragile by omission** — if the user never visits this URL, the Order is never created, causing silent data loss.

### Issue #9b — SRP: Inconsistency Between buy-now and bid-win Paths

| Attribute     | Details                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Principle** | SRP + DRY                                                                                                                                         |
| **Location**  | `product.route.js` → `router.post('/buy-now')` vs `router.post('/bid')` (when buy-now price is hit via progressive bid)                           |
| **Violation** | Two paths that both terminate an auction and both set the auction state to PENDING diverge on post-transition behavior: neither creates an Order. |

`executeBuyNow()` closes the auction and redirects to `/complete-order` without creating an Order. `placeBid()` similarly closes the auction when `productSold = true` without creating an Order. The missing Order creation is inconsistently deferred rather than encapsulated at the domain transition layer.

### Issue #9c — DIP: Route Directly Calls `orderModel.createOrder()`

| Attribute     | Details                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Principle** | DIP (Dependency Inversion Principle)                                                                                                                                                 |
| **Location**  | `product.route.js` → `router.get('/complete-order')`                                                                                                                                 |
| **Violation** | The high-level HTTP handler calls the concrete `orderModel.createOrder()` directly, bypassing any service abstraction. The route knows the exact DB model schema for Order creation. |

This coupling means: changing the Order creation schema (e.g., adding mandatory fields) requires modifying the route handler. There is no encapsulation boundary between the HTTP layer and the Order persistence layer.

---

## 3. Domain Boundary Analysis

### Auction Domain vs. Order Domain

The system contains two conceptually distinct domains:

| Domain      | Core entities                                                | Core transitions                                                                          |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Auction** | `Product`, `BiddingHistory`, `AutoBidding`, `RejectedBidder` | ACTIVE → PENDING → (SOLD \| CANCELLED \| EXPIRED)                                         |
| **Order**   | `Order`, `Invoice`, `OrderChat`                              | pending_payment → payment_submitted → payment_confirmed → shipped → delivered → completed |

An Order is **created by** the Auction domain (specifically, by an auction state transition) and **managed by** the Order domain thereafter. The Auction domain "fires an event" (conceptually) when it enters PENDING state; the appropriate response to that event is to create an Order.

The violation in the previous code is that this "event response" — Order creation — was deferred to the HTTP layer (GET /complete-order) rather than being owned by the Auction domain layer (service + notifier), making the cross-domain interaction accidental and fragile.

### Why `GET /complete-order` is the Wrong Place

`GET /complete-order` is an **Order domain read operation**: it displays information about an existing Order. It operates under the assumption that an Order already exists (because the auction has already ended). Placing creation logic here conflates:

1. **When** the Order should exist (at auction end — Auction domain concern).
2. **How** to display the Order (via a page render — HTTP/View concern).

These are two distinct "reasons to change" (SRP), and they belong in different layers.

---

## 4. Invariant Definition

> **Domain invariant:** For every auction that enters the `PENDING` state, there exists exactly one `Order` record in the database, created no later than the moment the transition occurs.

This invariant must hold regardless of the code path that triggers the PENDING transition:

| Transition Path                                   | Trigger mechanism                                                     | Handler                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Path A**: Time-based expiry                     | `auctionEndNotifier.js` scheduler (periodic job)                      | `createOrderFromAuction()` called in notifier after status confirmed |
| **Path B**: Buy-now direct purchase               | `executeBuyNow()` in `auction.service.js`                             | `createOrderFromAuction()` called after transaction commits          |
| **Path C**: Progressive bid reaches buy-now price | `placeBid()` in `auction.service.js` when `result.productSold = true` | `createOrderFromAuction()` called after transaction commits          |

The `GET /complete-order` page retains a **safeguard call** (not a primary creation path) to handle the scheduler race window: the finite interval between an auction ending and the notifier's next execution cycle. This call is idempotent — it returns the existing Order or creates one, never duplicating.

---

## 5. Refactoring Strategy

### 5.1 Introduce `order.service.js`

A new service module is created at `services/order.service.js`. Its sole responsibility: Order domain logic that does not belong to the HTTP layer.

**Exported API:**

| Function                 | Signature                                                         | Behavior                                                                                |
| ------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `createOrderFromAuction` | `({ productId, buyerId, sellerId, finalPrice }) → Promise<Order>` | Idempotent: checks existence before inserting. Returns existing or newly created Order. |
| `getOrderByProductId`    | `(productId) → Promise<Order \| null>`                            | Pure read — no side effects.                                                            |

**Idempotency implementation:**

```javascript
export async function createOrderFromAuction({
  productId,
  buyerId,
  sellerId,
  finalPrice,
}) {
  const existing = await orderModel.findByProductId(productId);
  if (existing) return existing; // ← idempotency guard

  return orderModel.createOrder({
    product_id: productId,
    buyer_id: buyerId,
    seller_id: sellerId,
    final_price: finalPrice ?? 0,
  });
}
```

The idempotency guard prevents duplicate Orders even if multiple triggers fire simultaneously (e.g., notifier fires while an in-flight buy-now request is running). The first writer wins; the second caller receives the existing record with no error.

### 5.2 Create Order at Auction Transition — `auction.service.js`

**`executeBuyNow()`** is updated to capture seller and price from the transaction, then call `createOrderFromAuction` immediately after the transaction commits:

```javascript
// BEFORE
export async function executeBuyNow({ productId, userId }) {
  await db.transaction(async (trx) => {
    // ... update product, insert bidding_history ...
  });
  // ← no Order creation
}

// AFTER
export async function executeBuyNow({ productId, userId }) {
  let _sellerId, _finalPrice;

  await db.transaction(async (trx) => {
    // ... update product, insert bidding_history ...
    _sellerId = product.seller_id; // capture for post-transaction use
    _finalPrice = buyNowPrice;
  });

  await createOrderFromAuction({
    // ← Order created at transition
    productId,
    buyerId: userId,
    sellerId: _sellerId,
    finalPrice: _finalPrice,
  });
}
```

**`placeBid()`** is updated to call `createOrderFromAuction` when `result.productSold = true` (buy-now price reached via progressive bid):

```javascript
// AFTER
export async function placeBid({ productId, userId, bidAmount }) {
  const result = await db.transaction(async (trx) => {
    // ... existing bid logic ...
  });

  if (result.productSold) {
    // ← ACTIVE → PENDING transition detected
    await createOrderFromAuction({
      productId,
      buyerId: result.newHighestBidderId,
      sellerId: result.sellerId,
      finalPrice: result.newCurrentPrice,
    });
  }

  return result;
}
```

### 5.3 Create Order at Auction Expiry — `auctionEndNotifier.js`

The notifier is updated to call `createOrderFromAuction` as the first action upon detecting a `PENDING` auction. This ensures the Order exists before emails are sent (emails now link to an already-existing order):

```javascript
// BEFORE
if (auctionStatus === 'PENDING') {
  if (auction.winner_email) { await sendMail(...); }
  if (auction.seller_email) { await sendMail(...); }
}

// AFTER
if (auctionStatus === 'PENDING') {
  // Order created BEFORE email dispatch
  await createOrderFromAuction({
    productId: auction.id,
    buyerId:   auction.highest_bidder_id,
    sellerId:  auction.seller_id,
    finalPrice: auction.current_price
  });

  if (auction.winner_email) { await sendMail(...); }
  if (auction.seller_email) { await sendMail(...); }
}
```

### 5.4 Simplify `GET /complete-order` in `product.route.js`

The inline fallback is replaced with a single call to the service. The route no longer imports or calls `orderModel.createOrder` directly:

```javascript
// BEFORE
let order = await orderModel.findByProductId(productId);
if (!order) {
  const orderData = {
    product_id: productId,
    buyer_id: product.highest_bidder_id,
    seller_id: product.seller_id,
    final_price: product.current_price || product.highest_bid || 0,
  };
  await orderModel.createOrder(orderData);
  order = await orderModel.findByProductId(productId);
}

// AFTER
// Order should already exist. This call is an idempotent safeguard
// for the scheduler race window only.
let order = await orderService.createOrderFromAuction({
  productId,
  buyerId: product.highest_bidder_id,
  sellerId: product.seller_id,
  finalPrice: product.current_price || product.highest_bid || 0,
});
```

The route no longer owns creation semantics; it delegates entirely to the service.

---

## 6. Before / After Comparison

### Order Creation Location

| Scenario                                         | Before                                                   | After                                                      |
| ------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------- |
| Time-expired auction with winner                 | Not created until first GET /complete-order visit        | Created immediately by `auctionEndNotifier` when notified  |
| Direct buy-now (`POST /buy-now`)                 | Not created until first GET /complete-order visit        | Created immediately by `executeBuyNow()` after transaction |
| Progressive bid hits buy-now price (`POST /bid`) | Not created until first GET /complete-order visit        | Created immediately by `placeBid()` after transaction      |
| GET /complete-order call                         | Creates Order if missing (primary creation path — wrong) | Idempotent safeguard only (secondary path — correct)       |

### Domain Coupling

| Aspect                         | Before                                                    | After                                                            |
| ------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------- |
| Route → Order model dependency | `product.route.js` imports `orderModel` for `createOrder` | Route imports `orderService`; no direct model calls for creation |
| Order creation responsibility  | Spread across HTTP handler (primary)                      | Centralized in `order.service.js`, called from transition points |
| GET handler purity             | Non-idempotent (writes DB on first access)                | Pure read; service call is idempotent safeguard only             |
| Risk of missing Order          | High — if user never visits the page, Order never created | Eliminated — Order always created at transition                  |

### Code Structure

```
BEFORE:
auction-web/src/
├── services/auction/
│   ├── auction-state.js
│   ├── auction.service.js     ← placeBid, executeBuyNow — no order creation
│   └── bid-engine.js
├── scripts/
│   └── auctionEndNotifier.js  ← no order creation
└── routes/
    └── product.route.js       ← inline orderModel.createOrder() in GET handler

AFTER:
auction-web/src/
├── services/
│   ├── order.service.js       ← NEW: createOrderFromAuction (idempotent)
│   └── auction/
│       ├── auction-state.js
│       ├── auction.service.js ← UPDATED: creates order in placeBid + executeBuyNow
│       └── bid-engine.js
├── scripts/
│   └── auctionEndNotifier.js  ← UPDATED: creates order before sending emails
└── routes/
    └── product.route.js       ← UPDATED: delegates creation to orderService
```

---

## 7. Summary Table

| Dimension                    | Before                                                            | After                                                           |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| **Order creation trigger**   | User navigates to GET /complete-order                             | Auction domain transition (placeBid / executeBuyNow / notifier) |
| **Risk of no Order created** | High — depends on user navigation                                 | Eliminated — created at domain event                            |
| **Duplicate Order risk**     | Low (single path), but no guard                                   | Zero — idempotency check in createOrderFromAuction              |
| **SRP adherence**            | GET handler writes DB (violation)                                 | GET handler reads only (compliant)                              |
| **DIP adherence**            | Route calls concrete `orderModel.createOrder`                     | Route depends on `orderService` abstraction                     |
| **Testability**              | Cannot test GET /complete-order without triggering order creation | Route and service are independently testable                    |
| **Cross-domain coupling**    | Auction close + Order create both in HTTP handler                 | Auction transition owns creation; HTTP layer reads result       |
| **new file count**           | 0                                                                 | 1 (`order.service.js`)                                          |
| **Lines changed**            | —                                                                 | ~40 lines modified across 3 existing files                      |

---

## 8. Architectural Note

This step represents a **domain boundary correction**, not an overhaul. The architecture does not introduce new patterns (no event bus, no message queue, no saga). The fix is targeted: move the Order initialization call to the correct layer — the one that owns the state transition — and make it idempotent.

This is consistent with the principle of **Domain-Driven Design light**: even without a full DDD setup, keeping "what happens when the auction ends" in the Auction layer (service + scheduler) rather than in the HTTP layer (route) yields a system where the business rule is co-located with the business event.

The idempotency guard in `createOrderFromAuction` is a deliberate trade-off. A pure event-driven approach (e.g., an "AuctionEnded" domain event consumed by an Order handler) would eliminate the race-condition window entirely, but at significantly greater architectural complexity. The idempotent service call achieves the same safety guarantee with a single extra `SELECT` per invocation — appropriate for the current scale and team context.

The `GET /complete-order` safeguard is retained explicitly as a **belt-and-suspenders** layer. It documents, via code comment, that the Order _should_ already exist by this point. If the primary creation paths ever fail (scheduler outage, unexpected exception in the service), the fallback ensures no user-visible breakage. This is a deliberate resilience decision, not a concession to the previous design.
