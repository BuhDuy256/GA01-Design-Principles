# Product.route.js - Refactoring Analysis Report

**Analyzed File:** `auction-web/src/routes/product.route.js` (1436 lines)  
**Analysis Date:** March 1, 2026  
**Analyst:** Senior Backend Architect

---

## SECTION 1 — CROSS-ROUTE VIOLATIONS

### 1.1 Pagination Logic Duplication

**Violation Type:** DRY violation  
**Affected Routes:** `/category`, `/search`

**Repeated Code Pattern:**

```javascript
// In /category (lines 44-72)
const page = parseInt(req.query.page) || 1;
const limit = 3;
const offset = (page - 1) * limit;
// ... data fetch ...
const totalCount = parseInt(total.count) || 0;
const nPages = Math.ceil(totalCount / limit);
let from = (page - 1) * limit + 1;
let to = page * limit;
if (to > totalCount) to = totalCount;
if (totalCount === 0) { from = 0; to = 0; }
res.render('vwProduct/list', {
  products, totalCount, from, to,
  currentPage: page, totalPages: nPages, ...
});

// In /search (lines 104-132)
const limit = 3;
const page = parseInt(req.query.page) || 1;
const offset = (page - 1) * limit;
// ... data fetch ...
const totalCount = parseInt(total.count) || 0;
const nPages = Math.ceil(totalCount / limit);
let from = (page - 1) * limit + 1;
let to = page * limit;
if (to > totalCount) to = totalCount;
if (totalCount === 0) { from = 0; to = 0; }
res.render('vwProduct/list', {
  products, totalCount, from, to,
  currentPage: page, totalPages: nPages, ...
});
```

**Why This Violates DRY:**  
Identical 10-line pagination calculation and boundary handling logic duplicated across 2 routes. Any bug fix or enhancement (e.g., configurable page size) requires changing both locations.

---

### 1.2 User ID Extraction from Session

**Violation Type:** DRY violation  
**Affected Routes:** `/category`, `/search`, `/detail`, `/watchlist` (POST), `/watchlist` (DELETE), `/bid`, `/comment`, `/reject-bidder`, `/unreject-bidder`, `/buy-now`

**Repeated Code Pattern:**

```javascript
// Pattern A (nullable user - lines 40, 83, 136)
const userId = req.session.authUser ? req.session.authUser.id : null;

// Pattern B (authenticated user - lines 251, 307, 320, 335, 828)
const userId = req.session.authUser.id;
```

**Why This Violates DRY/SRP:**  
Session interrogation logic repeated 10+ times. No abstraction layer. If session structure changes (e.g., `authUser` → `currentUser`), 10+ locations must be updated.

---

### 1.3 Referer-Based Redirect Pattern

**Violation Type:** DRY violation  
**Affected Routes:** `/watchlist` (POST), `/watchlist` (DELETE)

**Repeated Code Pattern:**

```javascript
// In POST /watchlist (line 317)
const retUrl = req.headers.referer || "/";
res.redirect(retUrl);

// In DELETE /watchlist (line 328)
const retUrl = req.headers.referer || "/";
res.redirect(retUrl);
```

**Why This Violates DRY:**  
Identical redirect-to-previous-page logic duplicated. Both routes have the same success handling pattern.

---

### 1.4 Flash Message Pattern Duplication

**Violation Type:** DRY violation  
**Affected Routes:** `/detail`, `/bid`, `/comment`, `/complete-order`

**Repeated Code Pattern:**

```javascript
// Setting flash messages (in /bid, /comment)
req.session.success_message = "Some message";
res.redirect(`/products/detail?id=${productId}`);
// OR
req.session.error_message = error.message;
res.redirect(`/products/detail?id=${productId}`);

// Retrieving flash messages (in /detail, lines 232-235)
const success_message = req.session.success_message;
const error_message = req.session.error_message;
delete req.session.success_message;
delete req.session.error_message;
```

**Why This Violates DRY:**  
Flash message set/retrieve/delete pattern repeated across 4+ routes. No abstraction for flash handling. Session key names hardcoded everywhere.

---

### 1.5 Product Ownership Verification

**Violation Type:** DRY violation  
**Affected Routes:** `/detail`, `/reject-bidder`, `/unreject-bidder`, `/buy-now`

**Repeated Code Pattern:**

```javascript
// In /reject-bidder (lines 1020-1025)
const product = await trx("products")
  .where("id", productId)
  .forUpdate()
  .first();
if (!product) {
  throw new Error("Product not found");
}
if (product.seller_id !== sellerId) {
  throw new Error("Only the seller can reject bidders");
}

// In /unreject-bidder (lines 1210-1218)
const product = await productModel.findByProductId2(productId, sellerId);
if (!product) {
  throw new Error("Product not found");
}
if (product.seller_id !== sellerId) {
  throw new Error("Only the seller can unreject bidders");
}

// In /detail (lines 178-191) - Authorization check
const isSeller = product.seller_id === userId;
const isHighestBidder = product.highest_bidder_id === userId;
if (!isSeller && !isHighestBidder) {
  return res
    .status(403)
    .render("403", { message: "You do not have permission..." });
}
```

**Why This Violates DRY:**  
Ownership verification pattern repeated 4+ times with slight variations. Different error messages for the same business rule.

---

### 1.6 Auction End-Time Validation

**Violation Type:** DRY violation  
**Affected Routes:** `/detail`, `/bid`, `/reject-bidder`, `/unreject-bidder`, `/buy-now`

**Repeated Code Pattern:**

```javascript
// In /detail (lines 154-161)
const now = new Date();
const endDate = new Date(product.end_at);
if (endDate <= now && !product.closed_at && product.is_sold === null) {
  await productModel.updateProduct(productId, { closed_at: endDate });
  product.closed_at = endDate;
}

// In /bid (lines 395-400)
const now = new Date();
const endDate = new Date(product.end_at);
if (now > endDate) {
  throw new Error("Auction has ended");
}

// In /reject-bidder (lines 1027-1033)
const now = new Date();
const endDate = new Date(product.end_at);
if (product.is_sold !== null || endDate <= now || product.closed_at) {
  throw new Error("Can only reject bidders for active auctions");
}

// In /buy-now (lines 1270-1278)
const now = new Date();
const endDate = new Date(product.end_at);
if (product.is_sold !== null) {
  throw new Error("Product is no longer available");
}
if (endDate <= now || product.closed_at) {
  throw new Error("Auction has already ended");
}
```

**Why This Violates DRY:**  
Same business rule (check if auction ended) implemented 5 different ways across routes. Variations in conditions (`now > endDate` vs `endDate <= now`), error messages, and side effects (auto-close logic only in one place).

---

### 1.7 Rating Calculation Pattern

**Violation Type:** DRY violation  
**Affected Routes:** `/detail`, `/seller/:sellerId/ratings`, `/bidder/:bidderId/ratings`

**Repeated Code Pattern:**

```javascript
// In /detail (lines 237-247)
const sellerRatingObject = await reviewModel.calculateRatingPoint(
  product.seller_id,
);
const sellerReviews = await reviewModel.getReviewsByUserId(product.seller_id);
let bidderRatingObject = { rating_point: null };
let bidderReviews = [];
if (product.highest_bidder_id) {
  bidderRatingObject = await reviewModel.calculateRatingPoint(
    product.highest_bidder_id,
  );
  bidderReviews = await reviewModel.getReviewsByUserId(
    product.highest_bidder_id,
  );
}

// In /seller/:sellerId/ratings (lines 1361-1374)
const ratingData = await reviewModel.calculateRatingPoint(sellerId);
const rating_point = ratingData ? ratingData.rating_point : 0;
const reviews = await reviewModel.getReviewsByUserId(sellerId);
const totalReviews = reviews.length;
const positiveReviews = reviews.filter((r) => r.rating === 1).length;
const negativeReviews = reviews.filter((r) => r.rating === -1).length;

// In /bidder/:bidderId/ratings (lines 1403-1416)
const ratingData = await reviewModel.calculateRatingPoint(bidderId);
const rating_point = ratingData ? ratingData.rating_point : 0;
const reviews = await reviewModel.getReviewsByUserId(bidderId);
const totalReviews = reviews.length;
const positiveReviews = reviews.filter((r) => r.rating === 1).length;
const negativeReviews = reviews.filter((r) => r.rating === -1).length;
```

**Why This Violates DRY:**  
Rating statistics calculation (total, positive, negative counts) duplicated in 3 routes. Filtering logic repeated.

---

### 1.8 Database Transaction Pattern

**Violation Type:** DRY violation  
**Affected Routes:** `/bid`, `/reject-bidder`, `/buy-now`

**Repeated Code Pattern:**

```javascript
// In /bid (lines 343-350)
const result = await db.transaction(async (trx) => {
  const product = await trx("products")
    .where("id", productId)
    .forUpdate()
    .first();
  if (!product) {
    throw new Error("Product not found");
  }
  // ... business logic
});

// In /reject-bidder (lines 1013-1021)
await db.transaction(async (trx) => {
  const product = await trx("products")
    .where("id", productId)
    .forUpdate()
    .first();
  if (!product) {
    throw new Error("Product not found");
  }
  // ... business logic
});

// In /buy-now (lines 1248-1258)
await db.transaction(async (trx) => {
  const product = await trx("products")
    .leftJoin("users as seller", "products.seller_id", "seller.id")
    .where("products.id", productId)
    .select("products.*", "seller.fullname as seller_name")
    .first();
  if (!product) {
    throw new Error("Product not found");
  }
  // ... business logic
});
```

**Why This Violates DRY:**  
Identical transaction initialization pattern with product row-level locking repeated 3 times. Product fetch + null check + error throw duplicated.

---

### 1.9 Rejected Bidder Check

**Violation Type:** DRY violation  
**Affected Routes:** `/bid`, `/buy-now`

**Repeated Code Pattern:**

```javascript
// In /bid (lines 367-375)
const isRejected = await trx("rejected_bidders")
  .where("product_id", productId)
  .where("bidder_id", userId)
  .first();
if (isRejected) {
  throw new Error(
    "You have been rejected from bidding on this product by the seller",
  );
}

// In /buy-now (lines 1297-1305)
const isRejected = await trx("rejected_bidders")
  .where({ product_id: productId, bidder_id: userId })
  .first();
if (isRejected) {
  throw new Error("You have been rejected from bidding on this product");
}
```

**Why This Violates DRY:**  
Same query and validation logic duplicated. Minor variations in error messages and query syntax.

---

### 1.10 Seller Self-Bidding Prevention

**Violation Type:** DRY violation  
**Affected Routes:** `/bid`, `/buy-now`

**Repeated Code Pattern:**

```javascript
// In /bid (lines 362-365)
if (product.seller_id === userId) {
  throw new Error("You cannot bid on your own product");
}

// In /buy-now (lines 1263-1266)
if (product.seller_id === userId) {
  throw new Error("Seller cannot buy their own product");
}
```

**Why This Violates DRY:**  
Same business rule (sellers can't bid on own products) with different error messages.

---

### 1.11 Rating Point Eligibility Check

**Violation Type:** DRY violation  
**Affected Routes:** `/bid`, `/buy-now`

**Repeated Code Pattern:**

```javascript
// In /bid (lines 377-393)
const ratingPoint = await reviewModel.calculateRatingPoint(userId);
const userReviews = await reviewModel.getReviewsByUserId(userId);
const hasReviews = userReviews.length > 0;
if (!hasReviews) {
  if (!product.allow_unrated_bidder) {
    throw new Error(
      "This seller does not allow unrated bidders to bid on this product.",
    );
  }
} else if (ratingPoint.rating_point < 0) {
  throw new Error("You are not eligible to place bids due to your rating.");
} else if (ratingPoint.rating_point === 0) {
  throw new Error("You are not eligible to place bids due to your rating.");
} else if (ratingPoint.rating_point <= 0.8) {
  throw new Error(
    "Your rating point is not greater than 80%. You cannot place bids.",
  );
}

// In /buy-now (lines 1307-1318) - Simplified version
if (!product.allow_unrated_bidder) {
  const bidder = await trx("users").where("id", userId).first();
  const ratingData = await reviewModel.calculateRatingPoint(userId);
  const ratingPoint = ratingData ? ratingData.rating_point : 0;
  if (ratingPoint === 0) {
    throw new Error("This product does not allow bidders without ratings");
  }
}
```

**Why This Violates DRY:**  
Complex rating eligibility logic partially duplicated. `/bid` has full validation, `/buy-now` has partial validation. Inconsistent behavior across similar actions.

---

### 1.12 Email Notification Pattern

**Violation Type:** DRY violation  
**Affected Routes:** `/bid`, `/comment`, `/reject-bidder`

**Repeated Code Pattern:**

```javascript
// All routes follow this pattern:
(async () => {
  try {
    // Fetch user data
    const user = await userModel.findById(userId);

    // Send email with inline HTML template (30-100 lines)
    await sendMail({
      to: user.email,
      subject: "...",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(...);">
            <h1 style="color: white; margin: 0;">...</h1>
          </div>
          <div style="background-color: #f8f9fa; padding: 30px;">
            ... (massive inline HTML)
          </div>
        </div>
      `,
    });
  } catch (emailError) {
    console.error("Failed to send email:", emailError);
  }
})();
```

**Found in:**

- `/bid` (lines 584-753) - 170 lines of email templates for 3 different recipients
- `/comment` (lines 853-948) - 95 lines for seller notifications
- `/reject-bidder` (lines 1157-1190) - 34 lines for rejection notification

**Why This Violates DRY:**  
Email sending pattern with error suppression repeated 3+ times. Inline HTML templates violate SRP. No email template abstraction.

---

### 1.13 Product URL Construction

**Violation Type:** DRY violation  
**Affected Routes:** `/bid`, `/comment`

**Repeated Code Pattern:**

```javascript
const productUrl = `${req.protocol}://${req.get("host")}/products/detail?id=${productId}`;
```

**Found in:** Lines 584, 842

**Why This Violates DRY:**  
URL construction logic duplicated. No centralized URL builder.

---

## SECTION 2 — ARCHITECTURAL VIOLATIONS

### 2.1 Single Responsibility Principle (SRP) Violations

**Problem:** Route handlers violate SRP by combining multiple responsibilities.

**Example: `/bid` route (lines 332-787) has 455 lines doing:**

1. HTTP request parsing (lines 335-337)
2. Input validation (lines 402-415)
3. Business logic (lines 418-520 - automatic bidding algorithm)
4. Database transaction management (lines 343-576)
5. Authorization checks (lines 362-393)
6. Email sending (lines 584-753)
7. Response formatting (lines 760-776)
8. Session manipulation (lines 779-780)
9. Error handling (lines 782-787)

**Why This Violates SRP:**  
One function has 9 distinct responsibilities. Impossible to test in isolation. Changes to email templates require editing business logic file. Violates "one reason to change" principle.

---

### 2.2 Dependency Inversion Principle (DIP) Violations

**Problem:** Controllers depend on concrete implementations, not abstractions.

**Direct Database Access Examples:**

```javascript
// Line 343 - Direct Knex transaction usage
const result = await db.transaction(async (trx) => {
  const product = await trx('products')
    .where('id', productId)
    .forUpdate()
    .first();

  // Lines 347-576 - Raw Knex queries throughout transaction
  await trx('rejected_bidders').where('product_id', productId)...
  await trx('bidding_history').insert({...});
  await trx.raw(`INSERT INTO auto_bidding ...`);
});
```

**Why This Violates DIP:**

- Controllers directly depend on Knex library
- Hard to mock for testing
- Cannot swap database implementations
- Business logic tightly coupled to query syntax
- Violates "depend on abstractions, not concretions"

---

### 2.3 Business Logic in Controllers

**Problem:** Complex domain logic embedded in HTTP handlers.

**Example 1: Automatic Bidding Algorithm (lines 418-520)**

```javascript
// 100+ lines of bidding logic inside route handler
if (
  buyNowPrice &&
  product.highest_bidder_id &&
  product.highest_max_price &&
  product.highest_bidder_id !== userId
) {
  const currentHighestMaxPrice = parseFloat(product.highest_max_price);
  if (currentHighestMaxPrice >= buyNowPrice) {
    newCurrentPrice = buyNowPrice;
    newHighestBidderId = product.highest_bidder_id;
    newHighestMaxPrice = currentHighestMaxPrice;
    buyNowTriggered = true;
  }
}
if (!buyNowTriggered) {
  if (product.highest_bidder_id === userId) {
    newCurrentPrice = parseFloat(
      product.current_price || product.starting_price,
    );
    newHighestBidderId = userId;
    newHighestMaxPrice = bidAmount;
    shouldCreateHistory = false;
  } else if (!product.highest_bidder_id || !product.highest_max_price) {
    // ... more complex logic
  }
}
```

**Example 2: Product Status Determination (lines 154-175)**

```javascript
// Complex state machine logic in controller
let productStatus = "ACTIVE";
if (endDate <= now && !product.closed_at && product.is_sold === null) {
  await productModel.updateProduct(productId, { closed_at: endDate });
  product.closed_at = endDate;
}
if (product.is_sold === true) {
  productStatus = "SOLD";
} else if (product.is_sold === false) {
  productStatus = "CANCELLED";
} else if ((endDate <= now || product.closed_at) && product.highest_bidder_id) {
  productStatus = "PENDING";
} else if (endDate <= now && !product.highest_bidder_id) {
  productStatus = "EXPIRED";
} else if (endDate > now && !product.closed_at) {
  productStatus = "ACTIVE";
}
```

**Example 3: Price Recalculation in `/reject-bidder` (lines 1078-1149)**

```javascript
// 70+ lines of recalculation logic in route handler
if (allAutoBids.length === 0) {
  await trx('products').where('id', productId).update({
    highest_bidder_id: null,
    current_price: product.starting_price,
    highest_max_price: null
  });
} else if (allAutoBids.length === 1) {
  const winner = allAutoBids[0];
  const newPrice = product.starting_price;
  await trx('products').where('id', productId).update({
    highest_bidder_id: winner.bidder_id,
    current_price: newPrice,
    highest_max_price: winner.max_price
  });
  if (wasHighestBidder || product.current_price !== newPrice) {
    await trx('bidding_history').insert({...});
  }
} else if (wasHighestBidder) {
  // ... more complex calculation
}
```

**Why This Violates SRP/Clean Architecture:**

- Domain logic (bidding rules, status transitions) should be in domain layer
- Controllers should only orchestrate, not implement business rules
- Cannot reuse this logic in CLI, background jobs, or API endpoints
- Cannot unit test business logic without HTTP mocking

---

### 2.4 Transaction Management in Controllers

**Problem:** Controllers manage database transactions directly.

**Examples:**

```javascript
// Line 343 (/bid)
const result = await db.transaction(async (trx) => {
  /* 233 lines */
});

// Line 1008 (/reject-bidder)
await db.transaction(async (trx) => {
  /* 143 lines */
});

// Line 1248 (/buy-now)
await db.transaction(async (trx) => {
  /* 82 lines */
});
```

**Why This Violates Clean Architecture:**

- Transaction boundaries should be defined by use cases, not HTTP endpoints
- Controllers should not know about transaction isolation levels
- Mixing transaction control with HTTP concerns
- Cannot compose transactional operations
- Hard to test rollback scenarios

---

### 2.5 Email Service Coupling

**Problem:** Email sending logic embedded in controllers with fire-and-forget pattern.

**Example from `/bid` (lines 584-753):**

```javascript
// Fire and forget - don't await email sending
(async () => {
  try {
    const [seller, currentBidder, previousBidder] = await Promise.all([...]);
    const emailPromises = [];

    // 170 lines of email HTML templates
    emailPromises.push(sendMail({
      to: seller.email,
      subject: `💰 New bid on your product: ${result.productName}`,
      html: `<div style="...">  // 50+ lines of inline HTML
    }));

    await Promise.all(emailPromises);
  } catch (emailError) {
    console.error('Failed to send bid notification emails:', emailError);
  }
})();
```

**Why This Violates SRP:**

- Email templates (presentation logic) in business logic file
- Side effects (email sending) mixed with HTTP handling
- No way to test email content without running route
- Email errors swallowed silently
- Cannot configure email behavior without editing route

---

### 2.6 Session Manipulation Throughout

**Problem:** Direct session access across all routes without abstraction.

**Examples:**

```javascript
// Reading session (lines 40, 83, 136, etc.)
const userId = req.session.authUser ? req.session.authUser.id : null;

// Writing flash messages (lines 779-780)
req.session.success_message = baseMessage;

// Reading flash messages (lines 232-235)
const success_message = req.session.success_message;
const error_message = req.session.error_message;
delete req.session.success_message;
delete req.session.error_message;
```

**Why This Violates DIP:**

- Controllers depend on session structure
- No abstraction for flash messages
- Cannot switch session storage mechanism
- Hard to test routes requiring session data
- Tight coupling to Express session middleware

---

### 2.7 Inconsistent Error Handling

**Problem:** Multiple error handling patterns across routes.

**Pattern 1: Try/Catch with Redirect (lines 782-787)**

```javascript
} catch (error) {
  console.error('Bid error:', error);
  req.session.error_message = error.message || 'An error occurred while placing bid. Please try again.';
  res.redirect(`/products/detail?id=${productId}`);
}
```

**Pattern 2: Try/Catch with JSON Response (lines 1193-1201)**

```javascript
} catch (error) {
  console.error('Error rejecting bidder:', error);
  res.status(400).json({
    success: false,
    message: error.message || 'Failed to reject bidder'
  });
}
```

**Pattern 3: Try/Catch with Switch Statement (lines 805-818)**

```javascript
} catch (error) {
  switch (error.code) {
    case 'PRODUCT_NOT_FOUND':
      return res.status(404).render('404', { message: 'Product not found' });
    case 'NOT_PENDING':
      return res.status(400).render('400', { message: 'Order is not in pending state' });
    case 'FORBIDDEN':
      return res.status(403).render('403', { message: 'You do not have permission...' });
    default:
      console.error('Complete order page error:', error);
      return res.status(500).render('500', { message: 'Server Error' });
  }
}
```

**Pattern 4: Try/Catch with Render (lines 301-306)**

```javascript
} catch (error) {
  console.error('Error loading bidding history:', error);
  res.status(500).render('500', { message: 'Unable to load bidding history' });
}
```

**Pattern 5: No Try/Catch**  
Routes `/category`, `/search` have no error handling.

**Why This Violates Consistency:**

- 5 different error handling approaches
- No centralized error middleware
- Mix of HTML renders, JSON responses, redirects
- Inconsistent status codes for similar errors
- No standard error response shape

---

### 2.8 View Logic in Controllers

**Problem:** Controllers contain presentation logic that belongs in view layer or domain.

**Example: Product Status Determination (lines 154-175)**

This is domain logic masquerading as view preparation.

**Example: Bidder Name Masking (lines 1422-1426)**

```javascript
const maskedName = bidder.fullname
  ? bidder.fullname
      .split("")
      .map((char, index) => (index % 2 === 0 ? char : "*"))
      .join("")
  : "";
```

**Why This Violates SRP:**

- Presentation formatting in controller
- Should be in view helper or domain model
- Cannot reuse masking logic in other contexts

---

### 2.9 Model Layer Leakage

**Problem:** Controllers know too much about database structure.

**Examples:**

```javascript
// Line 551 - Raw SQL in controller
await trx.raw(
  `
  INSERT INTO auto_bidding (product_id, bidder_id, max_price)
  VALUES (?, ?, ?)
  ON CONFLICT (product_id, bidder_id)
  DO UPDATE SET 
    max_price = EXCLUDED.max_price,
    created_at = NOW()
`,
  [productId, userId, bidAmount],
);

// Lines 367-372 - Direct table access
const isRejected = await trx("rejected_bidders")
  .where("product_id", productId)
  .where("bidder_id", userId)
  .first();
```

**Why This Violates Layering:**

- Controllers know table names (`rejected_bidders`, `auto_bidding`)
- Controllers know column names (`product_id`, `bidder_id`)
- Controllers know database-specific syntax (PostgreSQL `ON CONFLICT`)
- Cannot abstract database operations for testing

---

### 2.10 Tight Coupling to Express

**Problem:** Routes cannot be tested or reused outside Express context.

**Examples:**

```javascript
// Lines 317, 328 - Express-specific APIs
const retUrl = req.headers.referer || '/';

// Line 584 - Express request object used for URL building
const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;

// Throughout - Direct req/res manipulation
req.session.authUser.id
res.render('vwProduct/list', {...})
res.redirect(retUrl)
res.json({ success: true, ... })
```

**Why This Violates DIP:**

- Cannot port routes to other frameworks (Fastify, Koa)
- Cannot invoke business logic from CLI or background jobs
- Hard to unit test without mocking entire Express request/response

---

## SECTION 3 — COMPLEXITY HOTSPOTS

### 3.1 `/bid` Route - Extreme Complexity

**Location:** Lines 332-787 (455 lines)  
**Cyclomatic Complexity:** ~45+  
**Function Length:** 455 lines

**Complexity Breakdown:**

- **Conditional branches:** 30+
  - Line 350: `if (!product)`
  - Line 359: `if (product.is_sold === true)`
  - Line 364: `if (product.seller_id === userId)`
  - Line 374: `if (isRejected)`
  - Line 383-393: 5 levels of `if/else if` for rating checks
  - Line 399: `if (now > endDate)`
  - Line 408: `if (bidAmount <= currentPrice)`
  - Line 414: `if (bidAmount < currentPrice + minIncrement)`
  - Line 419: `if (product.auto_extend)`
  - Line 428: `if (minutesRemaining <= triggerMinutes)`
  - Line 451: `if (buyNowPrice && product.highest_bidder_id && ...)`
  - Line 455: `if (currentHighestMaxPrice >= buyNowPrice)`
  - Line 465: `if (!buyNowTriggered)`
  - Line 467-515: Nested automatic bidding logic with 5 cases
  - Line 517: `if (buyNowPrice && newCurrentPrice >= buyNowPrice)`
  - Line 527: `if (productSold)`
  - Line 533: `else if (extendedEndTime)`
  - Line 543: `if (shouldCreateHistory)`

- **Nested transaction logic:** 233 lines (lines 343-576)
- **Email templates:** 170 lines (lines 584-753)
- **Database operations:** 10+ queries inside transaction

**Specific Complexity Issues:**

1. **Automatic Bidding Algorithm (lines 467-515):**
   - 5 different scenarios
   - Nested conditionals 4 levels deep
   - Complex price calculation logic
   - Flag-based control flow (`shouldCreateHistory`, `buyNowTriggered`)

2. **Buy Now Special Handling (lines 451-462):**
   - Multiple conditions combined with `&&`
   - Side effect: sets `buyNowTriggered` flag
   - Affects downstream logic flow

3. **Auto-Extend Logic (lines 420-436):**
   - Fetches system settings
   - Time calculation
   - Conditional state mutation

4. **Email Sending (lines 584-753):**
   - 3 different recipient types
   - Conditional email content
   - Parallel array building
   - Async IIFE with error suppression

**Why This Is a Problem:**

- Impossible to understand full behavior without reading entire function
- Cannot test individual pieces in isolation
- High risk of bugs when modifying any part
- Violates "function should do one thing" principle
- Merge conflict nightmare for team collaboration

---

### 3.2 `/detail` Route - Moderate Complexity

**Location:** Lines 135-274 (139 lines)  
**Cyclomatic Complexity:** ~20

**Complexity Issues:**

1. **Product Status State Machine (lines 154-175):**

   ```javascript
   let productStatus = "ACTIVE";
   if (endDate <= now && !product.closed_at && product.is_sold === null) {
     // Auto-close logic with side effect
   }
   if (product.is_sold === true) {
     productStatus = "SOLD";
   } else if (product.is_sold === false) {
     productStatus = "CANCELLED";
   } else if (
     (endDate <= now || product.closed_at) &&
     product.highest_bidder_id
   ) {
     productStatus = "PENDING";
   } else if (endDate <= now && !product.highest_bidder_id) {
     productStatus = "EXPIRED";
   } else if (endDate > now && !product.closed_at) {
     productStatus = "ACTIVE";
   }
   ```

   - 6 possible states
   - Side effect in first conditional (database update)
   - Complex boolean expressions
   - Should be in domain model

2. **Authorization Logic (lines 177-191):**
   - Nested authorization check
   - Early returns
   - Role-based access control mixed with HTTP

3. **Comment Reply Batching (lines 206-223):**

   ```javascript
   if (comments.length > 0) {
     const commentIds = comments.map((c) => c.id);
     const allReplies =
       await productCommentModel.getRepliesByCommentIds(commentIds);
     const repliesMap = new Map();
     for (const reply of allReplies) {
       if (!repliesMap.has(reply.parent_id)) {
         repliesMap.set(reply.parent_id, []);
       }
       repliesMap.get(reply.parent_id).push(reply);
     }
     for (const comment of comments) {
       comment.replies = repliesMap.get(comment.id) || [];
     }
   }
   ```

   - Manual N+1 query prevention
   - Nested loops
   - Mutating comment objects
   - Should be in repository layer

4. **Parallel Query Coordination (lines 197-204):**
   - 4 parallel queries
   - No error handling for individual failures
   - Couples all data fetching together

**Why This Is a Problem:**

- Status determination logic cannot be reused
- Comment reply logic duplicates repository responsibility
- Authorization check embedded in route
- Hard to test status transitions

---

### 3.3 `/reject-bidder` Route - High Complexity

**Location:** Lines 1006-1201 (195 lines)  
**Cyclomatic Complexity:** ~25

**Complexity Issues:**

1. **Price Recalculation Logic (lines 1078-1149):**
   - 3 distinct scenarios (no bidders, 1 bidder, multiple bidders)
   - Each scenario has different history insertion logic
   - Complex price calculation for multiple bidders
   - Nested conditionals for history tracking

2. **Transaction with Multiple Side Effects:**
   - Insert into `rejected_bidders`
   - Delete from `bidding_history`
   - Delete from `auto_bidding`
   - Query remaining bidders
   - Update `products` table
   - Conditionally insert into `bidding_history`

3. **Was-Highest-Bidder Check (lines 1081-1084):**

   ```javascript
   const bidderIdNum = parseInt(bidderId);
   const highestBidderIdNum = parseInt(product.highest_bidder_id);
   const wasHighestBidder = highestBidderIdNum === bidderIdNum;
   ```

   - Type conversion complexity
   - Flag-based control flow

**Why This Is a Problem:**

- Business logic (price recalculation) in transaction block
- Cannot test recalculation logic without database
- Three different code paths hard to verify
- History insertion conditions hard to understand

---

### 3.4 `/comment` Route - Moderate Email Complexity

**Location:** Lines 821-959 (138 lines)  
**Cyclomatic Complexity:** ~15

**Complexity Issues:**

1. **Conditional Email Logic (lines 848-950):**
   - Determines if seller is replying
   - Different email sending logic for seller vs non-seller
   - Different templates for reply vs new question
   - Builds recipient map with deduplication

2. **Recipient Map Building (lines 853-865):**

   ```javascript
   const recipientsMap = new Map();
   bidders.forEach((b) => {
     if (b.id !== product.seller_id && b.email) {
       recipientsMap.set(b.id, { email: b.email, fullname: b.fullname });
     }
   });
   commenters.forEach((c) => {
     if (c.id !== product.seller_id && c.email) {
       recipientsMap.set(c.id, { email: c.email, fullname: c.fullname });
     }
   });
   ```

   - Manual deduplication
   - Filters out seller
   - Should be utility function

3. **Email Sending Loop (lines 868-896):**
   - Sequential email sending (not parallel)
   - Try/catch inside loop
   - Error logging per recipient

**Why This Is a Problem:**

- Email logic dominates route handler
- Conditional explosion for email types
- Inline HTML templates
- Sequential sending vs parallel in `/bid` route (inconsistent)

---

### 3.5 Inline Email HTML Templates

**Locations:**

- `/bid` (lines 595-748) - 154 lines of HTML
- `/comment` (lines 869-942) - 74 lines of HTML
- `/reject-bidder` (lines 1160-1187) - 28 lines of HTML

**Example (lines 595-750):**

```javascript
html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
      <h1 style="color: white; margin: 0;">New Bid Received!</h1>
    </div>
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
      <p>Dear <strong>${seller.fullname}</strong>,</p>
      <p>Great news! Your product has received a new bid:</p>
      <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #72AEC8;">
        <h3 style="margin: 0 0 15px 0; color: #333;">${result.productName}</h3>
        <p style="margin: 5px 0;"><strong>Bidder:</strong> ${currentBidder ? currentBidder.fullname : "Anonymous"}</p>
        <p style="margin: 5px 0;"><strong>Current Price:</strong></p>
        <p style="font-size: 28px; color: #72AEC8; margin: 5px 0; font-weight: bold;">
          ${new Intl.NumberFormat("en-US").format(result.newCurrentPrice)} VND
        </p>
        ${
          result.previousPrice !== result.newCurrentPrice
            ? `
        <p style="margin: 5px 0; color: #666; font-size: 14px;">
          <i>Previous: ${new Intl.NumberFormat("en-US").format(result.previousPrice)} VND</i>
        </p>
        `
            : ""
        }
      </div>
      ${
        result.productSold
          ? `
      <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="margin: 0; color: #155724;"><strong>🎉 Buy Now price reached!</strong> Auction has ended.</p>
      </div>
      `
          : ""
      }
      <div style="text-align: center; margin: 30px 0;">
        <a href="${productUrl}" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Product
        </a>
      </div>
    </div>
    <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">This is an automated message from Online Auction.</p>
  </div>
`;
```

**Why This Is a Problem:**

- **350+ lines of HTML** across 3 routes
- No template reusability
- Cannot test email rendering separately
- Hard to maintain consistent styling
- Cannot preview emails without running code
- Violates SRP (presentation in business logic)
- No email template versioning
- XSS risk if variables not properly escaped

---

### 3.6 Dead Code in `/bid-history/:productId`

**Location:** Lines 966-1004 (38 lines unreachable)

```javascript
router.get("/bid-history/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingHistoryModel.getBiddingHistory(productId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error("Get bid history error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load bidding history" });
  }

  // ==== EVERYTHING BELOW IS UNREACHABLE ====
  const result = await productModel.findByProductId(productId);
  const relatedProducts = await productModel.findRelatedProducts(productId);
  const product = {
    thumbnail: result[0].thumbnail,
    sub_images: result.reduce((acc, curr) => {
      if (curr.img_link) {
        acc.push(curr.img_link);
      }
      return acc;
    }, []),
    id: result[0].id,
    name: result[0].name,
    // ... 20+ lines of product object building ...
  };
  res.render("vwProduct/details", { product });
});
```

**Why This Is a Problem:**

- 38 lines of unreachable code after `try/catch` block
- Code will never execute
- Creates confusion about route's actual behavior
- Suggests incomplete refactoring or copy-paste error
- Linter should catch this (but doesn't)

---

### 3.7 Rating Routes Duplication

**Location:**

- `/seller/:sellerId/ratings` (lines 1346-1387) - 41 lines
- `/bidder/:bidderId/ratings` (lines 1389-1434) - 45 lines

**Nearly Identical Code:**

Both routes:

1. Parse ID from params
2. Redirect if invalid
3. Fetch user by ID
4. Redirect if not found
5. Calculate rating point
6. Fetch reviews
7. Calculate statistics (total, positive, negative)
8. Render view

**Only Difference:**

- Bidder route masks the name (lines 1422-1426)
- Different view templates (`seller-ratings` vs `bidder-ratings`)

**Why This Is a Problem:**

- 86 lines of nearly identical code
- Bug fix requires changing both routes
- Should be one route with parameter: `/:userType(seller|bidder)/:userId/ratings`

---

### 3.8 Console.log Pollution

**Found in:**

- Line 65: `console.log('Total products in category:', total.count);`
- Line 143: `console.log('Product details:', product);`
- Line 751: `console.log('${emailPromises.length} bid notification email(s) sent...');`
- Line 897: `console.log('Seller reply notification sent to ${recipientsMap.size} recipients');`
- Line 1195: `console.log('Rejection email sent to ${rejectedBidderInfo.email}...');`
- Multiple error logs: Lines 306, 752, 787, 895, 956, 1197

**Why This Is a Problem:**

- Debugging logs in production code
- No structured logging
- Cannot control log levels
- Sensitive data may leak (product details line 143)
- Should use proper logger with levels

---

### 3.9 Nested Conditional in Auto-Bidding

**Location:** Lines 467-520 (automatic bidding logic)

**Nesting Depth:** 4 levels

```javascript
if (!buyNowTriggered) {
  if (product.highest_bidder_id === userId) {
    // Case 0: Same bidder updating max price
    shouldCreateHistory = false;
  } else if (!product.highest_bidder_id || !product.highest_max_price) {
    // Case 1: First bid
  } else {
    // Case 2: Competition
    if (bidAmount < currentHighestMaxPrice) {
      // Case 2a: New bidder loses
    } else if (bidAmount === currentHighestMaxPrice) {
      // Case 2b: Tie - first bidder wins
    } else {
      // Case 2c: New bidder wins
    }
  }

  if (buyNowPrice && newCurrentPrice >= buyNowPrice) {
    // Check buy now after calculation
    buyNowTriggered = true;
  }
}
```

**Why This Is a Problem:**

- 4 levels of nesting
- Multiple exit conditions
- Flag-based control flow
- Hard to test all paths
- Should be strategy pattern or state machine

---

### 3.10 Long Parameter Lists in Responses

**Location:** Line 255 (`/detail` route render)

```javascript
res.render("vwProduct/details", {
  product,
  productStatus,
  authUser: req.session.authUser,
  descriptionUpdates,
  biddingHistory,
  rejectedBidders,
  comments,
  success_message,
  error_message,
  related_products,
  seller_rating_point: sellerRatingObject.rating_point,
  seller_has_reviews: sellerReviews.length > 0,
  bidder_rating_point: bidderRatingObject.rating_point,
  bidder_has_reviews: bidderReviews.length > 0,
  commentPage,
  totalPages,
  totalComments,
  showPaymentButton,
});
```

**19 parameters passed to view**

**Why This Is a Problem:**

- View receives massive object
- Hard to track what data view actually needs
- Should use ViewModel pattern
- Violates encapsulation
