# Refactoring Issues #8, #11, #12 — Route Cleanup: Thin Controllers

## Overview

After the route split in Step 7 (Issues #1, #3, #13), the three route files — `product.route.js`, `order.route.js`, and `rating.route.js` — still contained significant business and data-aggregation logic inline inside their handlers. This refactoring step extracts that residual logic into proper service-layer modules, completing the thin-controller pattern.

---

## Violated Design Principles (Before Refactoring)

| Issue | File | Location | Principle Violated | Description |
|--|--|--|--|--|
| #8 | `product.route.js` | `POST /comment` | SRP + DIP | Route handler directly constructed 3 full HTML email bodies and called `sendMail` inline — mixing HTTP concern with email-domain logic |
| #11 | `order.route.js` | `POST /submit-rating` | SRP + DRY | Route fetched DB records, built review upsert logic, and ran a 7-step "check both parties" workflow — all inside the route |
| #12 | `order.route.js` | `POST /complete-transaction` | SRP + DRY | Identical "check both parties → mark order complete → stamp product sold" block duplicated verbatim from Issue #11 |
| #8b | `rating.route.js` | GET handlers | SRP | Routes fetched models directly, computed stats with inline filter expressions, performed name-masking — all mixed with rendering |

---

## Refactoring Strategy

Apply the **thin-controller pattern**: route handlers own only the HTTP layer (parse input, call service, return response). All domain/business/aggregation logic lives exclusively in the service layer.

```
HTTP Request
     │
     ▼
[Route Handler]  ←── Thin: validate input, call service, send response only
     │
     ▼
[Service Layer]  ←── Business logic, DB queries, email dispatch, aggregation
     │
     ▼
[Model / DB / Mailer]
```

---

## Changes Made

### 1. New Service: `rating.service.js`

**Path:** `auction-web/src/services/rating.service.js`

Extracted from `rating.route.js` — all stat computation and name-masking logic.

```javascript
// Before (in route handler — ~50 lines):
const allReviews = await reviewModel.getReviewsByUserId(sellerId);
const totalReviews = allReviews.length;
const positiveReviews = allReviews.filter(r => r.rating === 1).length;
// ... repeated identically in bidder handler ...

// After (service layer, DRY):
function _computeStats(reviews) {
  return {
    totalReviews: reviews.length,
    positiveReviews: reviews.filter(r => r.rating === 1).length,
    negativeReviews: reviews.filter(r => r.rating === -1).length
  };
}
export async function getSellerRatingData(sellerId) { ... }
export async function getBidderRatingData(bidderId) { ... }  // + mask name
```

**DRY fix:** `_computeStats()` private helper eliminates the duplicated filter expressions from two separate handlers.

---

### 2. Extended Service: `notification.service.js` — Comment Notifications

**Path:** `auction-web/src/services/notification.service.js`

Extracted from `product.route.js POST /comment` — ~100 lines of inline HTML + email dispatch across 3 branches.

```javascript
// Before (in route — one branch shown):
for (const [recipientId, recipient] of recipientsMap) {
  await sendMail({
    to: recipient.email,
    subject: `Seller answered a question on: ${product.name}`,
    html: `<div style="...">... 25 lines of HTML ...</div>`
  });
}

// After (service layer):
export async function sendCommentNotifications({
  product, commenter, seller, content, parentId, userId, productUrl, bidders, commenters
}) {
  if (isSellerReplying && parentId)       return _notifyInterestedParties(...);
  if (userId !== seller.id && parentId)   return _sendReplyNotificationToSeller(...);
  if (userId !== seller.id)               return _sendQuestionNotificationToSeller(...);
}
```

Private helpers `_notifyInterestedParties`, `_sendReplyNotificationToSeller`, and `_sendQuestionNotificationToSeller` use the existing `buildEmailLayout()` and `buildCtaButton()` utilities already in the service — ensuring consistent email styling.

**SRP fix:** `product.route.js` is no longer responsible for knowing email content or mail-dispatch mechanics.

**DIP fix:** The route now depends on `notificationService` abstraction rather than importing `sendMail` directly.

---

### 3. Extended Service: `order.service.js` — Rating Submission & Transaction Completion

**Path:** `auction-web/src/services/order.service.js`

Extracted from `order.route.js` — two handlers each had identical 20-line "finalize order" blocks.

```javascript
// Before (duplicated verbatim in two route handlers):
const buyerReview  = await reviewModel.getProductReview(order.buyer_id,  order.seller_id, order.product_id);
const sellerReview = await reviewModel.getProductReview(order.seller_id, order.buyer_id,  order.product_id);
if (buyerReview && sellerReview) {
  await orderModel.updateStatus(orderId, 'completed', userId);
  await db('products').where('id', order.product_id).update({ is_sold: true, closed_at: new Date() });
}

// After (extracted to private helper → called by both service functions):
async function _finalizeIfBothCompleted(order, userId) { ... }

export async function submitRating({ orderId, userId, rating, comment }) {
  // auth check, review upsert, then:
  await _finalizeIfBothCompleted(order, userId);
  return { success: true, message: 'Rating submitted successfully' };
}

export async function completeTransaction({ orderId, userId }) {
  // auth check, create skip-review, then:
  await _finalizeIfBothCompleted(order, userId);
  return { success: true, message: 'Transaction completed' };
}
```

**DRY fix:** Duplicated ~20-line block consolidated into `_finalizeIfBothCompleted()`.

**SRP fix:** Route handlers no longer touch `reviewModel` or raw `db` — those dependencies moved entirely to the service.

---

## Before vs. After: Route Handler Size

| Route File | Handler | Lines Before | Lines After | Reduction |
|--|--|--|--|--|
| `rating.route.js` | GET /seller-rating | ~45 lines | 6 lines | −87% |
| `rating.route.js` | GET /bidder-rating | ~48 lines | 7 lines | −85% |
| `order.route.js` | POST /submit-rating | 57 lines | 15 lines | −74% |
| `order.route.js` | POST /complete-transaction | 58 lines | 15 lines | −74% |
| `product.route.js` | POST /comment | ~120 lines | 38 lines | −68% |

---

## Updated File Dependency Graph

```
Routes (HTTP boundary only)
├── product.route.js  →  productModel, productCommentModel, biddingHistoryModel
│                     →  auctionService, bidEngine
│                     →  notificationService   ← NEW dependency (replaces sendMail direct call)
│
├── order.route.js    →  orderModel, invoiceModel, orderChatModel
│                     →  orderService           ← submit-rating + complete-transaction now here
│                     (removed: reviewModel, db direct imports)
│
└── rating.route.js   →  ratingService          ← entire aggregation now here
                         (removed: userModel, reviewModel direct imports)

Services (domain logic)
├── notification.service.js  →  sendMail, buildEmailLayout, buildCtaButton
│   + sendCommentNotifications()   ← NEW
│
├── order.service.js         →  orderModel, reviewModel, db
│   + submitRating()          ← NEW
│   + completeTransaction()   ← NEW
│   + _finalizeIfBothCompleted()  ← NEW private
│
└── rating.service.js        →  userModel, reviewModel   ← NEWLY CREATED
    + getSellerRatingData()
    + getBidderRatingData()
    + _computeStats()         ← private
```

---

## Architectural Consistency

This step aligns the three domain route files with the architectural rule established across the entire project:

> **Routes parse HTTP. Services own logic. Models own persistence.**

Prior to this step, the route split (Step 7) created the correct file *structure* but left residual business logic in the handlers. With this step, all handlers conform to the thin-controller pattern: each handler is a 10–15-line function that validates input, calls one service method, and returns a response.

---

## Summary of Principle Improvements

| Principle | Before | After |
|--|--|--|
| **SRP** | Routes responsible for HTTP + DB + email HTML + stats calculation | Routes responsible for HTTP only |
| **DRY** | "Finalize order" block duplicated in 2 routes; stats filters duplicated in 2 route handlers | Each extracted once into `_finalizeIfBothCompleted()` / `_computeStats()` |
| **DIP** | `product.route.js` imported `sendMail` directly (low-level); `order.route.js` imported `reviewModel`/`db` directly | Routes depend on service abstractions only |
| **OCP** | Adding a 4th email case or a 3rd order-finalization path required editing route files | Adding new notification types only requires extending `notification.service.js` |
| **KISS** | Handlers were long and hard to unit-test | Handlers are visually simple; each service function is independently testable |
