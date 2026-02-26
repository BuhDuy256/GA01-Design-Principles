# Refactoring Plan: Flow 1 - Identity, Authentication & Account Recovery

Based on the [Code Audit Report](file:///d:/Software%20Engineer/System%20Design/GA01-Design-Principles/docs/Flow-01/code-audit-report.md) and the [Test Plan](file:///d:/Software%20Engineer/System%20Design/GA01-Design-Principles/docs/Flow-01/test-plan.md), this document outlines the step-by-step technical strategy for refactoring the `account.route.js` and associated Auth systems.

The primary goal is to resolve SOLID violations (especially the SRP "God Route" issue), eliminate duplicate code (DRY), and decouple route handling from business logic.

---

## Phase 1: Test Coverage (Pre-Refactor)

_Status: Completed_

- Unit tests for `user.model.js` implemented.
- Integration tests for `account.route.js` implemented using Supertest with mocked database (`db.js`), mailer (`mailer.js`), and `passport.js`.
- _Requirement:_ Ensure all tests pass continuously during the subsequent phases.

---

## Phase 2: Extract Utilities & Middlewares

**Goal:** Remove inline validation and boilerplate from the route handlers.

### 2.1 ReCAPTCHA Middleware

- **Action:** Extract the `fetch` call to Google reCAPTCHA from `POST /signup`.
- **Result:** Create `auction-web/src/middlewares/verifyCaptcha.js`.
- **Benefit:** Keeps the controller focused on domain logic; makes the route easily testable by bypassing the middleware in `account.route.test.js`.

### 2.2 Mailer Service Facade

- **Action:** Remove raw HTML strings from `account.route.js`.
- **Result:** Create an `AuthMailerService` in `utils/mailer.js` (or a dedicated `services/mailer.service.js`) with specific methods:
  - `sendVerificationOtp(email, fullname, otp, verifyUrl)`
  - `sendPasswordResetOtp(email, fullname, otp)`
- **Benefit:** Centralizes email templates (DRY/SRP).

---

## Phase 3: Service Layer Extraction (Business Logic)

**Goal:** Isolate business rules from Express HTTP Request/Response objects. This is the most critical step to fix the Big Ball of Mud architecture.

### 3.1 `AuthService` (`services/auth.service.js`)

- **Action:** Extract the core logic for Signup, Signin, and Password Recovery.
- **Methods to create:**
  - `registerUser(userData)`: Handles user creation, password hashing (`bcrypt`), OTP generation, and triggering the verification email.
  - `loginWithCredentials(email, password)`: Handles DB lookup, bcrypt comparison, and returning a status (success, invalid_credentials, unverified_email).
  - `processPasswordResetRequest(email)`: Handles finding user, creating OTP, and sending the "Forgot Password" email.
  - `resetPassword(email, newPassword)`: Handles password hashing and updating DB.
- **Benefit:** The Express route becomes incredibly thin. It only maps `req.body` to the service arguments, handles layout context mapping, and calls `res.render()` or `res.redirect()`.

### 3.2 `OAuthService` (`services/oauth.service.js`)

- **Action:** Resolve the huge duplication in `passport.js`.
- **Method to create:**
  - `resolveOAuthUser(provider, profile)`: Encapsulates the 40-line duplicated block. It checks if the `oauth_id` exists, falls back to `profile.emails[0]`, links accounts if necessary, or creates a new `bidder` user.
- **Benefit:** `passport.js` will become extremely concise. Adding a new OAuth provider will only require passing the profile to `resolveOAuthUser`.

---

## Phase 4: Route Separation (Dismantling the God Route)

**Goal:** Split the 725-line `account.route.js` into focused, bounded contexts.

### 4.1 Route Split Plan

Create the following route files and update `index.js` to mount them:

1.  **`routes/auth.route.js`**
    - _Path Prefix:_ `/auth` (or keep mapped natively in `index.js` to avoid breaking existing URLs).
    - _Scope:_ Signup, Signin, Verify Email, Forgot Password, Reset Password, Logout, OAuth callbacks.
    - _Dependencies:_ `AuthService`, `OAuthService`.
2.  **`routes/account.route.js`** _(Significantly reduced)_
    - _Scope:_ Render user profile (`/profile`), handle profile updates.
    - _Dependencies:_ `userModel`.
3.  **`routes/bidding-activity.route.js`** _(Or merged into `product.route.js`)_
    - _Scope:_ Moving `/watchlist`, `/bidding`, and `/auctions` out of the account route. These are fundamentally product/bidding domains.
    - _Dependencies:_ `watchlistModel`, `autoBiddingModel`.
4.  **`routes/reputation.route.js`**
    - _Scope:_ Moving `/ratings` and `/won-auctions/:productId/rate-seller` out.
    - _Dependencies:_ `reviewModel`.

---

## Phase 5: Verification & Cleanup

- Run the test suites (Unit + Integration).
- Manually verify the UI navigation using the new decoupled routes.
- Remove unused imports from all files.
- Confirm the code lines flagged in the audit report (SRP failures, manual HTML rendering) are successfully mitigated.
