# Screenshot Plan: Flow 1 Refactoring

This document outlines the specific code sections that need to be captured as screenshots to demonstrate the "Before" (technical debt) and "After" (clean code) states of the Flow 1 refactoring.

## 1. Massive God-Function (SRP & DRY Violations)

Demonstrates a single Express handler doing reCAPTCHA network validation, manual form validation, DB checks, password hashing, user insertion, OTP generation, and raw HTML email construction.

- **Before Image:**
  - **File:** `auction-web/src/routes/account.route.js`
  - **Target Lines:** `231 - 327` (`POST /signup`)
  - **Focus Point:** The mix of `fetch` for reCAPTCHA, `bcrypt`, and the raw HTML string inside `sendMail`.
- **After Image:**
  - **File:** `auction-web/src/routes/auth.route.js` (Or revised `account.route.js` if kept)
  - **Target Lines:** The refactored `POST /signup` handler.
  - **Focus Point:** The route should be < 10 lines long, simply calling `AuthService.registerUser(req.body)`.

## 2. Blatant Code Duplication (OAuth Logic)

Shows the exact same database lookup and user creation logic copy-pasted across different passport strategies.

- **Before Image:**
  - **File:** `auction-web/src/utils/passport.js`
  - **Target Lines:** `29 - 65` (Google Strategy) side-by-side with `76 - 106` (Facebook Strategy).
  - **Focus Point:** The identical blocks checking `findByOAuthProvider`, `findByEmail`, and `userModel.add({...})`.
- **After Image:**
  - **File:** `auction-web/src/utils/passport.js`
  - **Target Lines:** The refactored Strategies.
  - **Focus Point:** Google/Facebook strategies now simply calling a single line: `await OAuthService.resolveOAuthUser(provider, profile)`.

## 3. Duplicated OTP/Email Logic

Shows identical business logic scattered across different endpoints instead of being encapsulated in an `AuthService`.

- **Before Image:**
  - **File:** `auction-web/src/routes/account.route.js`
  - **Target Lines:** `75 - 103` (`POST /forgot-password`) side-by-side with `123 - 153` (`POST /resend-forgot-password-otp`).
  - **Focus Point:** The identical `generateOtp()`, `createOtp()`, and `sendMail({ html: ... })` blocks repeated.
- **After Image:**
  - **File:** `auction-web/src/services/auth.service.js` (or similar)
  - **Target Lines:** A standalone reusable function (e.g., `processPasswordResetRequest(email)`).
  - **Focus Point:** The centralized logic that generates the OTP and sends the email template.

## 4. Mixed Responsibilities in Account Route

Shows the account router directly handling product rating/reputation logic, completely outside the scope of user identity management.

- **Before Image:**
  - **File:** `auction-web/src/routes/account.route.js`
  - **Target Lines:** `597 - 631` (`POST /won-auctions/:productId/rate-seller`)
  - **Focus Point:** Route handling product ratings inside the account router document.
- **After Image:**
  - **File:** `auction-web/src/routes/reputation.route.js` (or `product.route.js` / wherever it is moved)
  - **Target Lines:** The new location of the `rate-seller` handler.
  - **Focus Point:** The physical separation of files.

---

### Instructions for taking screenshots:

1. Open the file in VS Code or your preferred IDE.
2. Ensure Syntax Highlighting is active.
3. Use a tool like Snipping Tool (Windows) or Snagit to capture the target line numbers.
4. Save the "Before" images _before_ running any refactoring steps.
