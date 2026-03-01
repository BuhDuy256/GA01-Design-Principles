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

---

## SECTION 4 — PHASED REFACTOR PLAN

### PHASE 1 — Cross-Route Cleanup (DRY Violations)

**Objective:** Extract duplicated logic into shared utilities without changing route behavior.

**Safety Level:** HIGH (no behavior changes)

---

#### PHASE 1.1 — Extract Pagination Utility

**Action:**

Create `src/utils/pagination.js`:

```javascript
export function calculatePagination(page, limit, totalCount) {
  const currentPage = parseInt(page) || 1;
  const offset = (currentPage - 1) * limit;
  const totalPages = Math.ceil(totalCount / limit);

  let from = (currentPage - 1) * limit + 1;
  let to = currentPage * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) {
    from = 0;
    to = 0;
  }

  return {
    currentPage,
    offset,
    totalPages,
    from,
    to,
  };
}
```

**Replace in:** `/category` (lines 44-72), `/search` (lines 104-132)

**Before:**

```javascript
const page = parseInt(req.query.page) || 1;
const limit = 3;
const offset = (page - 1) * limit;
// ... fetch data ...
const nPages = Math.ceil(totalCount / limit);
let from = (page - 1) * limit + 1;
let to = page * limit;
if (to > totalCount) to = totalCount;
if (totalCount === 0) {
  from = 0;
  to = 0;
}
```

**After:**

```javascript
const limit = 3;
const { currentPage, offset, totalPages, from, to } = calculatePagination(
  req.query.page,
  limit,
  totalCount,
);
```

**Benefit:** Reduces 20 lines to 2 lines. Centralizes pagination logic.

---

#### PHASE 1.2 — Extract User Session Helper

**Action:**

Create `src/utils/sessionHelpers.js`:

```javascript
export function getCurrentUserId(req) {
  return req.session.authUser ? req.session.authUser.id : null;
}

export function requireUserId(req) {
  if (!req.session.authUser) {
    throw new Error("User not authenticated");
  }
  return req.session.authUser.id;
}
```

**Replace in:** All routes (10+ locations)

**Before:**

```javascript
const userId = req.session.authUser ? req.session.authUser.id : null;
const userId = req.session.authUser.id;
```

**After:**

```javascript
const userId = getCurrentUserId(req);
const userId = requireUserId(req); // In authenticated routes
```

**Benefit:** Single point of change if session structure changes.

---

#### PHASE 1.3 — Extract Flash Message Utility

**Action:**

Create `src/utils/flashMessages.js`:

```javascript
export function setSuccessMessage(req, message) {
  req.session.success_message = message;
}

export function setErrorMessage(req, message) {
  req.session.error_message = message;
}

export function getFlashMessages(req) {
  const messages = {
    success_message: req.session.success_message,
    error_message: req.session.error_message,
  };
  delete req.session.success_message;
  delete req.session.error_message;
  return messages;
}
```

**Replace in:** `/detail` (lines 232-235), `/bid`, `/comment`, `/complete-order`

**Benefit:** Standardizes flash message handling. Prevents forgetting to delete.

---

#### PHASE 1.4 — Extract Referer Redirect Utility

**Action:**

Create `src/utils/redirectHelpers.js`:

```javascript
export function redirectToPreviousPage(req, res, fallback = "/") {
  const retUrl = req.headers.referer || fallback;
  res.redirect(retUrl);
}
```

**Replace in:** `/watchlist` POST/DELETE (lines 317, 328)

**Benefit:** Centralizes redirect logic. Easier to add security checks later.

---

#### PHASE 1.5 — Extract Rating Statistics Utility

**Action:**

Create `src/utils/ratingHelpers.js`:

```javascript
export function calculateRatingStatistics(reviews) {
  const totalReviews = reviews.length;
  const positiveReviews = reviews.filter((r) => r.rating === 1).length;
  const negativeReviews = reviews.filter((r) => r.rating === -1).length;

  return {
    totalReviews,
    positiveReviews,
    negativeReviews,
  };
}

export async function getUserRatingData(userId, reviewModel) {
  const ratingData = await reviewModel.calculateRatingPoint(userId);
  const rating_point = ratingData ? ratingData.rating_point : 0;
  const reviews = await reviewModel.getReviewsByUserId(userId);
  const statistics = calculateRatingStatistics(reviews);

  return {
    rating_point,
    reviews,
    ...statistics,
  };
}
```

**Replace in:** `/detail`, `/seller/:sellerId/ratings`, `/bidder/:bidderId/ratings`

**Benefit:** Eliminates 3 copies of rating calculation code.

---

#### PHASE 1.6 — Extract Product URL Builder

**Action:**

Create `src/utils/urlBuilders.js`:

```javascript
export function buildProductUrl(req, productId) {
  return `${req.protocol}://${req.get("host")}/products/detail?id=${productId}`;
}
```

**Replace in:** `/bid` (line 584), `/comment` (line 842)

**Benefit:** Centralizes URL generation. Easier to add URL signing later.

---

#### PHASE 1.7 — Unify Rating Routes

**Action:**

Replace two separate routes `/seller/:sellerId/ratings` and `/bidder/:bidderId/ratings` with:

```javascript
router.get("/:userType(seller|bidder)/:userId/ratings", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userType = req.params.userType;

    if (!userId) return res.redirect("/");

    const user = await userModel.findById(userId);
    if (!user) return res.redirect("/");

    const {
      rating_point,
      totalReviews,
      positiveReviews,
      negativeReviews,
      reviews,
    } = await getUserRatingData(userId, reviewModel);

    const userName =
      userType === "bidder"
        ? user.fullname
            .split("")
            .map((char, idx) => (idx % 2 === 0 ? char : "*"))
            .join("")
        : user.fullname;

    res.render(`vwProduct/${userType}-ratings`, {
      [`${userType}Name`]: userName,
      rating_point,
      totalReviews,
      positiveReviews,
      negativeReviews,
      reviews,
    });
  } catch (error) {
    console.error("Error loading ratings page:", error);
    res.redirect("/");
  }
});
```

**Benefit:** Eliminates 86 lines of duplicated code. Single source of truth.

---

### PHASE 2 — Architectural Cleanup (SOLID Violations)

**Objective:** Separate concerns by introducing service/domain layers.

**Safety Level:** MEDIUM (refactors but preserves behavior)

---

#### PHASE 2.1 — Create Service Layer Structure

**Action:**

Create new service files:

```
src/services/
├── product.service.js  (already exists - expand)
├── bidding.service.js  (NEW)
├── email.service.js     (NEW - rename from utils/mailer.js)
├── auth.service.js      (already exists - verify usage)
└── review.service.js    (NEW)
```

**Principle:** Each service handles one domain area.

---

#### PHASE 2.2 — Extract Bidding Service

**Action:**

Create `src/services/bidding.service.js`:

```javascript
export class BiddingService {
  async placeBid(productId, userId, bidAmount) {
    // Move entire transaction logic from /bid route here
    // Return result object (not HTTP response)
    // Throw domain exceptions (not HTTP errors)
  }

  async calculateAutomaticBid(product, userId, bidAmount) {
    // Extract lines 418-520 (automatic bidding algorithm)
    // Return { newPrice, newHighestBidderId, newMaxPrice, buyNowTriggered }
  }

  async checkBidEligibility(product, userId, bidAmount) {
    // Extract lines 359-415 (all validation checks)
    // Throw BidValidationError with specific codes
  }

  async handleBuyNow(productId, userId) {
    // Move /buy-now transaction logic here
  }

  async rejectBidder(productId, sellerId, bidderId) {
    // Move /reject-bidder transaction logic here
    // Return { rejectedBidder, updatedProduct }
  }

  async recalculatePriceAfterRejection(product, allAutoBids) {
    // Extract lines 1078-1149 (price recalculation)
    // Pure function - no side effects
  }
}
```

**Controller After Refactor:**

```javascript
router.post("/bid", isAuthenticated, async (req, res) => {
  const userId = requireUserId(req);
  const productId = parseInt(req.body.productId);
  const bidAmount = parseFloat(req.body.bidAmount.replace(/,/g, ""));

  try {
    const result = await biddingService.placeBid(productId, userId, bidAmount);

    // Send notifications asynchronously
    emailService
      .sendBidNotifications(productId, result, req)
      .catch(console.error);

    setSuccessMessage(req, formatBidSuccessMessage(result));
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    setErrorMessage(req, error.message);
    res.redirect(`/products/detail?id=${productId}`);
  }
});
```

**Line Reduction:** 455 lines → ~20 lines

**Benefit:**

- Business logic testable without HTTP
- Can reuse bidding logic in admin panel, API, background jobs
- Transaction boundaries defined by use case

---

#### PHASE 2.3 — Extract Product Status Domain Logic

**Action:**

Create `src/domain/ProductStatus.js`:

```javascript
export const ProductStatus = {
  ACTIVE: "ACTIVE",
  SOLD: "SOLD",
  CANCELLED: "CANCELLED",
  PENDING: "PENDING",
  EXPIRED: "EXPIRED",
};

export class Product {
  constructor(data) {
    Object.assign(this, data);
  }

  getStatus() {
    const now = new Date();
    const endDate = new Date(this.end_at);

    if (this.is_sold === true) return ProductStatus.SOLD;
    if (this.is_sold === false) return ProductStatus.CANCELLED;
    if ((endDate <= now || this.closed_at) && this.highest_bidder_id)
      return ProductStatus.PENDING;
    if (endDate <= now && !this.highest_bidder_id) return ProductStatus.EXPIRED;
    if (endDate > now && !this.closed_at) return ProductStatus.ACTIVE;

    return ProductStatus.ACTIVE;
  }

  shouldAutoClose() {
    const now = new Date();
    const endDate = new Date(this.end_at);
    return endDate <= now && !this.closed_at && this.is_sold === null;
  }

  hasEnded() {
    const now = new Date();
    const endDate = new Date(this.end_at);
    return now > endDate;
  }

  canUserView(userId) {
    const status = this.getStatus();
    if (status === ProductStatus.ACTIVE) return true;
    if (!userId) return false;

    const isSeller = this.seller_id === userId;
    const isHighestBidder = this.highest_bidder_id === userId;

    return isSeller || isHighestBidder;
  }
}
```

**Controller After Refactor:**

```javascript
router.get("/detail", async (req, res) => {
  const userId = getCurrentUserId(req);
  const productId = req.query.id;

  const productData = await productModel.findByProductId2(productId, userId);
  if (!productData) {
    return res.status(404).render("404", { message: "Product not found" });
  }

  const product = new Product(productData);

  // Auto-close if needed
  if (product.shouldAutoClose()) {
    await productModel.updateProduct(productId, { closed_at: new Date() });
  }

  // Authorization check
  if (!product.canUserView(userId)) {
    return res
      .status(403)
      .render("403", { message: "You do not have permission..." });
  }

  // ... rest of route
});
```

**Benefit:**

- Status determination logic centralized in domain model
- Can reuse in other routes
- Easier to test state transitions
- Self-documenting code

---

#### PHASE 2.4 — Extract Email Service with Templates

**Action:**

Create `src/services/email.service.js`:

```javascript
import { sendMail } from "../utils/mailer.js";
import * as emailTemplates from "../templates/emails/index.js";

export class EmailService {
  async sendBidNotifications(productId, bidResult, req) {
    // Move lines 584-753 here
    // Use template files instead of inline HTML
  }

  async sendCommentNotifications(productId, comment, req) {
    // Move comment email logic here
  }

  async sendRejectionNotification(bidder, product, req) {
    // Move rejection email logic here
  }
}
```

Create `src/templates/emails/` folder:

```
src/templates/emails/
├── index.js                    (exports all templates)
├── bidReceived.js              (seller notification)
├── bidPlaced.js                (bidder confirmation)
├── bidOutbid.js                (previous bidder)
├── commentNotification.js      (seller/buyer)
└── bidderRejected.js           (rejected bidder)
```

**Example Template (`bidReceived.js`):**

```javascript
export function bidReceivedTemplate({
  seller,
  product,
  currentBidder,
  currentPrice,
  previousPrice,
  productSold,
  productUrl,
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">New Bid Received!</h1>
      </div>
      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p>Dear <strong>${seller.fullname}</strong>,</p>
        <p>Great news! Your product has received a new bid:</p>
        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3>${product.name}</h3>
          <p><strong>Bidder:</strong> ${currentBidder?.fullname || "Anonymous"}</p>
          <p><strong>Current Price:</strong> ${formatPrice(currentPrice)} VND</p>
          ${previousPrice !== currentPrice ? `<p><i>Previous: ${formatPrice(previousPrice)} VND</i></p>` : ""}
        </div>
        ${productSold ? '<div class="alert">🎉 Buy Now price reached!</div>' : ""}
        <div style="text-align: center;">
          <a href="${productUrl}" class="button">View Product</a>
        </div>
      </div>
    </div>
  `;
}

function formatPrice(price) {
  return new Intl.NumberFormat("en-US").format(price);
}
```

**Benefit:**

- Separates email templates from business logic
- 350+ lines of HTML moved out of routes
- Can test email rendering separately
- Can version templates independently
- Easier for designers to modify

---

#### PHASE 2.5 — Create Error Handling Middleware

**Action:**

Create `src/middlewares/errorHandler.mdw.js`:

```javascript
export class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export function errorHandler(err, req, res, next) {
  if (err.isOperational) {
    // Operational error - safe to send to client
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      // API request - send JSON
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    } else {
      // Web request - render or redirect
      if (
        err.statusCode === 404 ||
        err.statusCode === 403 ||
        err.statusCode === 400
      ) {
        return res
          .status(err.statusCode)
          .render(err.statusCode.toString(), { message: err.message });
      } else {
        setErrorMessage(req, err.message);
        return res.redirect(req.headers.referer || "/");
      }
    }
  }

  // Programming error - don't leak details
  console.error("Unexpected error:", err);
  res.status(500).render("500", { message: "An unexpected error occurred" });
}
```

**Controller After Refactor:**

```javascript
router.post("/bid", isAuthenticated, async (req, res, next) => {
  const userId = requireUserId(req);
  const productId = parseInt(req.body.productId);
  const bidAmount = parseFloat(req.body.bidAmount.replace(/,/g, ""));

  try {
    const result = await biddingService.placeBid(productId, userId, bidAmount);
    emailService
      .sendBidNotifications(productId, result, req)
      .catch(console.error);
    setSuccessMessage(req, formatBidSuccessMessage(result));
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    next(error); // Pass to error middleware
  }
});
```

**In app.js:**

```javascript
import { errorHandler } from "./middlewares/errorHandler.mdw.js";

// ... routes ...

app.use(errorHandler); // Must be last middleware
```

**Benefit:**

- Unified error handling across all routes
- Consistent error responses
- Easier to add logging/monitoring
- Removes 5 different error handling patterns

---

#### PHASE 2.6 — Introduce Repository Pattern

**Action:**

Create `src/repositories/product.repository.js`:

```javascript
export class ProductRepository {
  async findByIdWithLock(productId, trx) {
    return await trx("products").where("id", productId).forUpdate().first();
  }

  async updateProduct(productId, data, trx) {
    return await trx("products").where("id", productId).update(data);
  }

  async isUserRejected(productId, userId, trx) {
    const result = await trx("rejected_bidders")
      .where({ product_id: productId, bidder_id: userId })
      .first();
    return !!result;
  }

  // Move all direct DB queries from services here
}
```

**Benefit:**

- Services don't know about database structure
- Can swap database implementations
- Easier to mock for testing
- Encapsulates query complexity

---

### PHASE 3 — Simplification (KISS Violations)

**Objective:** Reduce complexity, improve readability, flatten nesting.

**Safety Level:** MEDIUM (refactors logic but preserves behavior)

---

#### PHASE 3.1 — Simplify Automatic Bidding with Strategy Pattern

**Current Problem:** Lines 467-520 have 4 levels of nesting.

**Action:**

Create bidding strategies:

```javascript
// src/domain/biddingStrategies.js

class BiddingStrategy {
  execute(product, userId, bidAmount) {
    throw new Error("Not implemented");
  }
}

class FirstBidStrategy extends BiddingStrategy {
  execute(product, userId, bidAmount) {
    return {
      newCurrentPrice: product.starting_price,
      newHighestBidderId: userId,
      newHighestMaxPrice: bidAmount,
      shouldCreateHistory: true,
    };
  }
}

class SameBidderUpdateStrategy extends BiddingStrategy {
  execute(product, userId, bidAmount) {
    return {
      newCurrentPrice: parseFloat(
        product.current_price || product.starting_price,
      ),
      newHighestBidderId: userId,
      newHighestMaxPrice: bidAmount,
      shouldCreateHistory: false,
    };
  }
}

class CompetingBidStrategy extends BiddingStrategy {
  execute(product, userId, bidAmount) {
    const currentHighestMaxPrice = parseFloat(product.highest_max_price);
    const minIncrement = parseFloat(product.step_price);

    if (bidAmount < currentHighestMaxPrice) {
      return {
        newCurrentPrice: bidAmount,
        newHighestBidderId: product.highest_bidder_id,
        newHighestMaxPrice: currentHighestMaxPrice,
        shouldCreateHistory: true,
      };
    } else if (bidAmount === currentHighestMaxPrice) {
      return {
        newCurrentPrice: bidAmount,
        newHighestBidderId: product.highest_bidder_id,
        newHighestMaxPrice: currentHighestMaxPrice,
        shouldCreateHistory: true,
      };
    } else {
      return {
        newCurrentPrice: currentHighestMaxPrice + minIncrement,
        newHighestBidderId: userId,
        newHighestMaxPrice: bidAmount,
        shouldCreateHistory: true,
      };
    }
  }
}

export class BiddingStrategyFactory {
  static getStrategy(product, userId) {
    if (product.highest_bidder_id === userId) {
      return new SameBidderUpdateStrategy();
    } else if (!product.highest_bidder_id || !product.highest_max_price) {
      return new FirstBidStrategy();
    } else {
      return new CompetingBidStrategy();
    }
  }
}
```

**Service After Refactor:**

```javascript
async calculateAutomaticBid(product, userId, bidAmount) {
  // Check buy now special case
  if (this.shouldTriggerBuyNowForExistingBidder(product, userId, bidAmount)) {
    return this.createBuyNowResult(product);
  }

  // Get strategy and execute
  const strategy = BiddingStrategyFactory.getStrategy(product, userId);
  const result = strategy.execute(product, userId, bidAmount);

  // Check if buy now reached after calculation
  if (product.buy_now_price && result.newCurrentPrice >= product.buy_now_price) {
    result.newCurrentPrice = product.buy_now_price;
    result.buyNowTriggered = true;
  }

  return result;
}
```

**Benefit:**

- Nesting reduced from 4 levels to 1
- Each strategy testable independently
- Easier to add new bidding rules
- Self-documenting code

---

#### PHASE 3.2 — Flatten Product Status Determination

**Current Problem:** Lines 154-175 have cascading if/else.

**Action:**

Replace with guard clauses in domain model:

```javascript
getStatus() {
  if (this.is_sold === true) return ProductStatus.SOLD;
  if (this.is_sold === false) return ProductStatus.CANCELLED;

  const now = new Date();
  const endDate = new Date(this.end_at);
  const hasEnded = endDate <= now || this.closed_at;

  if (hasEnded && this.highest_bidder_id) return ProductStatus.PENDING;
  if (hasEnded && !this.highest_bidder_id) return ProductStatus.EXPIRED;

  return ProductStatus.ACTIVE;
}
```

**Benefit:**

- Early returns reduce nesting
- Easier to read
- Guard clause pattern

---

#### PHASE 3.3 — Extract Comment Reply Batching to Repository

**Current Problem:** Lines 206-223 have manual N+1 prevention in controller.

**Action:**

Move to `productComment.model.js`:

```javascript
export async function getCommentsWithReplies(productId, limit, offset) {
  const comments = await getCommentsByProductId(productId, limit, offset);

  if (comments.length === 0) return comments;

  const commentIds = comments.map((c) => c.id);
  const allReplies = await getRepliesByCommentIds(commentIds);

  // Group replies by parent
  const repliesMap = new Map();
  for (const reply of allReplies) {
    if (!repliesMap.has(reply.parent_id)) {
      repliesMap.set(reply.parent_id, []);
    }
    repliesMap.get(reply.parent_id).push(reply);
  }

  // Attach to comments
  for (const comment of comments) {
    comment.replies = repliesMap.get(comment.id) || [];
  }

  return comments;
}
```

**Controller After:**

```javascript
const comments = await productCommentModel.getCommentsWithReplies(
  productId,
  commentsPerPage,
  offset,
);
```

**Benefit:**

- Removes 17 lines from controller
- Repository responsibility for data loading
- Easier to optimize query later

---

#### PHASE 3.4 — Remove Dead Code

**Action:**

Delete lines 975-1004 (unreachable code after try/catch in `/bid-history/:productId`).

**Benefit:**

- 38 lines removed
- Eliminates confusion

---

#### PHASE 3.5 — Extract Validation Methods

**Action:**

Create `src/validators/bidding.validator.js`:

```javascript
export class BiddingValidator {
  static validateProduct(product) {
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    if (product.is_sold === true) {
      throw new ValidationError("This product has already been sold");
    }
  }

  static validateSellerNotBidding(product, userId) {
    if (product.seller_id === userId) {
      throw new ValidationError("You cannot bid on your own product");
    }
  }

  static validateNotRejected(isRejected) {
    if (isRejected) {
      throw new ValidationError(
        "You have been rejected from bidding on this product by the seller",
      );
    }
  }

  static validateRatingEligibility(ratingPoint, hasReviews, product) {
    if (!hasReviews) {
      if (!product.allow_unrated_bidder) {
        throw new ValidationError(
          "This seller does not allow unrated bidders to bid on this product.",
        );
      }
      return; // Unrated but allowed
    }

    if (ratingPoint.rating_point <= 0) {
      throw new ValidationError(
        "You are not eligible to place bids due to your rating.",
      );
    }

    if (ratingPoint.rating_point <= 0.8) {
      throw new ValidationError(
        "Your rating point is not greater than 80%. You cannot place bids.",
      );
    }
  }

  static validateAuctionActive(product) {
    const now = new Date();
    const endDate = new Date(product.end_at);

    if (now > endDate) {
      throw new ValidationError("Auction has ended");
    }
  }

  static validateBidAmount(bidAmount, currentPrice, minIncrement) {
    if (bidAmount <= currentPrice) {
      throw new ValidationError(
        `Bid must be higher than current price (${formatPrice(currentPrice)} VND)`,
      );
    }

    if (bidAmount < currentPrice + minIncrement) {
      throw new ValidationError(
        `Bid must be at least ${formatPrice(minIncrement)} VND higher than current price`,
      );
    }
  }
}
```

**Service After:**

```javascript
async placeBid(productId, userId, bidAmount) {
  return await db.transaction(async (trx) => {
    const product = await productRepo.findByIdWithLock(productId, trx);

    // Validation (now just method calls)
    BiddingValidator.validateProduct(product);
    BiddingValidator.validateSellerNotBidding(product, userId);

    const isRejected = await productRepo.isUserRejected(productId, userId, trx);
    BiddingValidator.validateNotRejected(isRejected);

    const { ratingPoint, hasReviews } = await this.getUserRatingInfo(userId);
    BiddingValidator.validateRatingEligibility(ratingPoint, hasReviews, product);

    BiddingValidator.validateAuctionActive(product);

    const currentPrice = parseFloat(product.current_price || product.starting_price);
    BiddingValidator.validateBidAmount(bidAmount, currentPrice, parseFloat(product.step_price));

    // Business logic...
  });
}
```

**Benefit:**

- 50+ lines of validation extracted to reusable validator
- Each validation method has single responsibility
- Easier to test validation rules
- Can reuse in API, admin panel, etc.

---

### PHASE 4 — Cleanup (YAGNI / Over-Engineering)

**Objective:** Remove unnecessary abstractions, debug code, unused logic.

**Safety Level:** LOW (requires analysis of actual usage)

---

#### PHASE 4.1 — Remove Console.log Statements

**Action:**

Replace all `console.log` with proper logger:

```javascript
import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  );
}

export default logger;
```

**Replace:**

```javascript
console.log("Total products in category:", total.count);
console.error("Bid error:", error);
```

**With:**

```javascript
logger.info("Total products in category", { count: total.count, categoryId });
logger.error("Bid error", {
  error: error.message,
  stack: error.stack,
  productId,
  userId,
});
```

**Benefit:**

- Structured logging
- Log levels (debug, info, warn, error)
- Can disable in production
- Can send to log aggregation service

---

#### PHASE 4.2 — Remove Commented Code and TODOs

**Action:**

Search for and remove:

- Commented-out code
- TODO comments without tracking
- Vietnamese comments (if standardizing on English)

**Example (lines 310-312):**

```javascript
// SỬA LẠI: Lấy địa chỉ trang trước đó từ header
// Nếu không tìm thấy (trường hợp hiếm), quay về trang chủ '/'
const retUrl = req.headers.referer || "/";
```

**Replace with:**

```javascript
// Redirect to previous page (referer) or home
const retUrl = req.headers.referer || "/";
```

**Benefit:**

- Cleaner codebase
- Standardized language
- Reduces noise

---

#### PHASE 4.3 — Evaluate Route `/bid-history/:productId` Necessity

**Action:**

Determine if this route is actually used:

1. Check frontend for AJAX calls to `/bid-history/:productId`
2. Check if `/bidding-history` route (lines 275-306) serves the same purpose

**If redundant:** Delete entire route (lines 966-1004)  
**If needed:** Fix unreachable code issue

**Benefit:**

- Removes dead or duplicate code
- Clarifies actual bidding history endpoint

---

#### PHASE 4.4 — Consolidate Models and Services

**Action:**

Review if all imported models are actually used:

```javascript
import * as invoiceModel from "../models/invoice.model.js";
import * as orderChatModel from "../models/orderChat.model.js";
```

Lines 12-13 import models but only `orderService` is used (line 18).

**If unused:** Remove imports.

**Benefit:**

- Reduces module load time
- Clearer dependencies
- Easier to track usage

---

#### PHASE 4.5 — Standardize Response Shapes

**Action:**

All JSON API responses should follow consistent structure:

```javascript
// Success
{
  success: true,
  data: { ... },
  message: "Optional success message"
}

// Error
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Human-readable message"
  }
}
```

**Currently inconsistent:**

- Line 971: `{ success: true, data: history }`
- Line 974: `{ success: false, message: '...' }`
- Line 1340: `{ success: true, message: '...', redirectUrl: '...' }`

**Benefit:**

- Frontend can expect consistent responses
- Easier to build API client
- Professional API design

---

## SUMMARY

### Cross-Route Issues Found

| Category                | Count             | Total Lines Duplicated |
| ----------------------- | ----------------- | ---------------------- |
| Pagination Logic        | 2 routes          | ~40 lines              |
| User Session Extraction | 10+ locations     | ~10 lines              |
| Flash Messages          | 4+ routes         | ~20 lines              |
| Product Ownership       | 4 routes          | ~60 lines              |
| Auction End Validation  | 5 routes          | ~50 lines              |
| Rating Calculation      | 3 routes          | ~45 lines              |
| Transaction Pattern     | 3 routes          | ~30 lines              |
| Email Notifications     | 3 routes          | ~350 lines             |
| **TOTAL**               | **~34 instances** | **~605 lines**         |

### Architectural Issues Found

| Violation                        | Severity | Impact                           |
| -------------------------------- | -------- | -------------------------------- |
| Business logic in controllers    | HIGH     | Cannot test, reuse, or maintain  |
| Direct database access           | HIGH     | Tight coupling, hard to test     |
| Transaction management in routes | HIGH     | Violates clean architecture      |
| Email templates in routes        | MEDIUM   | Violates SRP, hard to maintain   |
| No error handling middleware     | MEDIUM   | Inconsistent error responses     |
| Session coupling                 | MEDIUM   | Hard to test, can't swap session |

### Complexity Hotspots Found

| Route             | Lines | Cyclomatic Complexity | Main Issue                                                   |
| ----------------- | ----- | --------------------- | ------------------------------------------------------------ |
| `/bid`            | 455   | ~45                   | Does everything: HTTP, validation, business logic, DB, email |
| `/detail`         | 139   | ~20                   | Status determination, N+1 prevention, authorization in route |
| `/reject-bidder`  | 195   | ~25                   | Complex price recalculation in transaction                   |
| `/comment`        | 138   | ~15                   | Email logic dominates route                                  |
| **Rating routes** | 86    | ~10 each              | Nearly identical (duplication)                               |

### Refactoring Impact Estimate

| Phase                    | Estimated Effort | Lines Reduced   | Risk Level     |
| ------------------------ | ---------------- | --------------- | -------------- |
| Phase 1 (DRY cleanup)    | 2-3 days         | ~600 lines      | LOW            |
| Phase 2 (Architecture)   | 5-7 days         | ~800 lines      | MEDIUM         |
| Phase 3 (Simplification) | 3-4 days         | ~300 lines      | MEDIUM         |
| Phase 4 (Cleanup)        | 1-2 days         | ~100 lines      | LOW            |
| **TOTAL**                | **11-16 days**   | **~1800 lines** | **MANAGEABLE** |

### Before/After Comparison (Estimated)

**Current State:**

- Total lines: 1436
- Routes: 15
- Average route length: 95 lines
- Longest route: 455 lines
- Duplicated code: ~605 lines
- Inline HTML: 350+ lines

**After Refactor:**

- Total lines (routes file): ~600-700 lines
- Routes: 14 (merge rating routes)
- Average route length: 45 lines
- Longest route: ~80 lines (after service extraction)
- Duplicated code: <50 lines
- Inline HTML: 0 lines

**Code moved to:**

- Services: ~800 lines
- Domain models: ~200 lines
- Validators: ~150 lines
- Email templates: ~350 lines
- Utilities: ~100 lines

---

## END OF ANALYSIS

All violations have been catalogued. The phased refactor plan preserves behavior while systematically improving structure. Phase 1 is safe to execute immediately. Phases 2-4 require incremental implementation with testing between steps.
