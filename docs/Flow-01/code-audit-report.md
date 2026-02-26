# Flow 1: Identity, Authentication & Account Recovery - Code Audit Report

## 1. Violated Design Principles (SOLID, KISS, DRY, YAGNI)

### SOLID Violations

- **Single Responsibility Principle (SRP):**
  - `src/routes/account.route.js` violates SRP severely. It handles HTTP request parsing, input validation, business logic (e.g., computing rating points), external API calls (Google reCAPTCHA via `fetch`), password hashing (`bcrypt`), OTP generation, and email sending formatting (HTML template strings).
  - `src/models/user.model.js` combines standard User CRUD methods with OTP management methods (`createOtp`, `findValidOtp`, `markOtpUsed`), mixing two different domain concepts.
- **Open-Closed Principle (OCP):**
  - `src/utils/passport.js` requires modification every time a new OAuth provider is added because the user resolution logic is hardcoded inside each strategy callback.
- **Dependency Inversion Principle (DIP):**
  - Routes are directly dependent on low-level modules like `bcryptjs` and `db.js` (Knex) instead of relying on an intermediate authentication service or user core domain service.

### KISS & DRY (Don't Repeat Yourself) Violations

- **OTP & Email Sending:** The exact same sequence of generating an OTP, calculating expiration time, saving to DB, constructing an HTML email, and sending it via `sendMail` is duplicated across 4 different routes: `POST /signin` (for unverified users), `POST /signup`, `POST /forgot-password`, and `POST /resend-forgot-password-otp`.
- **OAuth User Resolution:** In `src/utils/passport.js`, the exact same 30-line block of logic (check if OAuth user exists -> check if email exists -> create new user if not) is completely copy-pasted for Google, Facebook, Twitter, and GitHub strategies.
- **Password Hashing:** `bcrypt.hashSync` is called separately in `/signup`, `/reset-password`, and `/profile`.

### YAGNI (You Aren't Gonna Need It)

- The `account.route.js` includes routes that belong to completely different flows, such as `/watchlist`, `/bidding`, and `/auctions` (which handles ratings). These features are not strictly part of "Identity/Account Recovery" and bloat the account router unnecessarily.

---

## 2. God Route

**File:** `src/routes/account.route.js`
This file is a textbook "God Route" (725 lines long). It attempts to orchestrate multiple distinct business flows:

1.  Session & Auth state (Signin / Logout)
2.  Identity Creation (Signup + ReCAPTCHA validation)
3.  Account Recovery (Forgot/Reset Password, OTPs)
4.  User Profile Management (View / Update Profile)
5.  Reputation System (Viewing user ratings and calculating statistics)
6.  Bidding Activities (Watchlist, Currently Bidding, Won Auctions)
7.  Action mechanisms (Requesting upgrade to Seller status, Rating sellers)
8.  OAuth entry points

This single file imports 6 different models (`user`, `upgradeRequest`, `watchlist`, `review`, `autoBidding`) and orchestrates workflows that span across Identity, Buyer Participation, and Reputation metrics.

---

## 3. High Coupling

- **Route <-> Utility Coupling:** `account.route.js` is tightly coupled to `process.env` (reading RECAPTCHA keys), `mailer.js`, and `bcryptjs`. Any change to how emails are formatted or how passwords are hashed requires digging into the Express route definitions.
- **Route <-> Display Coupling:** The routes are tightly coupled to the Handlebars views, often passing down complex computed objects (e.g., manual calculations of pagination for watchlist, or calculating positive/negative reviews).
- **Route <-> External API:** The `POST /signup` route is coupled to the Google reCAPTCHA REST API directly via a `fetch` call, preventing the signup logic from being easily tested without a live network connection.

---

## 4. Lines That Need Screenshots

For presentations or reports, capture the following sections to demonstrate the technical debt:

1.  **Massive God-Function (SRP & DRV violation):**
    - **File:** `src/routes/account.route.js`
    - **Lines:** `L231 - L327` (`POST /signup`)
    - **Why:** Demonstrates a single Express handler doing reCAPTCHA network validation, manual form validation, database checks, password hashing, user insertion, OTP generation, and raw HTML email construction.
2.  **Blatant Code Duplication (OAuth Logic):**
    - **File:** `src/utils/passport.js`
    - **Lines:** `L29 - L65` (Google) vs `L76 - L106` (Facebook)
    - **Why:** Shows the exact same database lookup and user creation logic copy-pasted across different passport strategies.
3.  **Duplicated OTP/Email Logic:**
    - **File:** `src/routes/account.route.js`
    - **Lines:** `L75 - L103` (`POST /forgot-password`) vs `L123 - L153` (`POST /resend-forgot-password-otp`)
    - **Why:** Shows identical business logic scattered across different endpoints instead of being encapsulated in an `AuthService.generateAndSendOtp()` utility.
4.  **Mixed Responsibilities in Account Route:**
    - **File:** `src/routes/account.route.js`
    - **Lines:** `L597 - L631` (`POST /won-auctions/:productId/rate-seller`)
    - **Why:** Shows the account router directly handling product rating/reputation logic, completely outside the scope of user identity management.
