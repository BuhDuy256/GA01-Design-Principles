# Test Plan: Flow 1 - Identity, Authentication & Account Recovery

This document outlines the testing strategy for Flow 1 based on the design flaws identified in the code audit. The goal is to ensure stability and correctness across Identity Creation, Authentication, and Account Recovery.

## 1. Testing Strategy Overview

Due to the monolithic nature of `account.route.js` and the tight coupling discovered in the code audit (SRP, DRY, and DIP violations), testing will require a mix of:

- **Unit Tests:** For isolated utility functions or extracted business logic (once refactored).
- **Integration Tests (API Level):** The primary focus. We will use Supertest to hit the `/account/*` endpoints with mocked dependencies (like DB and Mailer) to verify the "God Route" behavior without triggering real emails or needing manual reCAPTCHA solving.

---

## 2. Unit Testing Plan (Jest)

Currently, business logic is embedded inside Express routes, making unit testing difficult. However, we can unit test the Database Models directly.

### Target: `src/models/user.model.js`

| Test ID     | Method               | Test Description                     | Expected Result                                  |
| :---------- | :------------------- | :----------------------------------- | :----------------------------------------------- |
| `UT-USR-01` | `add(user)`          | Insert a new user with valid data    | Returns subset of user obj (`id`, `email`, etc.) |
| `UT-USR-02` | `findByEmail(email)` | Query existing vs non-existing email | Returns user object or `undefined`               |
| `UT-USR-03` | `createOtp(...)`     | Create an OTP for `verify_email`     | Record inserted successfully                     |
| `UT-USR-04` | `findValidOtp(...)`  | Find valid vs expired vs used OTP    | Returns only valid un-used OTP                   |
| `UT-USR-05` | `markOtpUsed(id)`    | Mark an OTP as used                  | Subsequent `findValidOtp` returns `undefined`    |

### Target: `src/utils/passport.js` (Pending Refactor)

_Note: OAuth logic is currently tightly coupled to Passport callbacks. To unit test, the user-resolution block (L29-L65) should be extracted to an `AuthService`._

---

## 3. Integration Testing Plan (Supertest + Jest)

These tests will hit the Express router directly. **Crucially, we must mock `sendMail` (from `utils/mailer.js`) and the Google reCAPTCHA `fetch` call to prevent flakiness and external dependencies.**

### Target: Registration & Verification Flow (`/account/signup`, `/account/verify-email`)

| Test ID     | Endpoint             | Payload / Condition                                         | Expected Result                                                                 |
| :---------- | :------------------- | :---------------------------------------------------------- | :------------------------------------------------------------------------------ |
| `IT-REG-01` | `POST /signup`       | Missing required fields / password mismatch                 | `200 OK`, renders form with `error_message`                                     |
| `IT-REG-02` | `POST /signup`       | Invalid reCAPTCHA (mock `fetch` to return `success: false`) | `200 OK`, renders form with `errors.captcha`                                    |
| `IT-REG-03` | `POST /signup`       | Valid data & valid reCAPTCHA                                | `302 Redirect` to `/verify-email`, DB user created, `sendMail` mock called once |
| `IT-REG-04` | `POST /verify-email` | Valid OTP                                                   | `302 Redirect` to `/signin`, `user.email_verified == true`                      |
| `IT-REG-05` | `POST /verify-email` | Invalid/Expired OTP                                         | `200 OK`, renders form with `error_message`                                     |

### Target: Authentication Flow (`/account/signin`)

| Test ID      | Endpoint       | Payload / Condition                          | Expected Result                                           |
| :----------- | :------------- | :------------------------------------------- | :-------------------------------------------------------- |
| `IT-AUTH-01` | `POST /signin` | Non-existent email                           | `200 OK`, renders form with `error_message`               |
| `IT-AUTH-02` | `POST /signin` | Wrong password                               | `200 OK`, renders form with `error_message`               |
| `IT-AUTH-03` | `POST /signin` | Correct creds, but `email_verified == false` | `302 Redirect` to `/verify-email`, `sendMail` mock called |
| `IT-AUTH-04` | `POST /signin` | Correct creds, `email_verified == true`      | `302 Redirect` to `/` (or returnUrl), session active      |

### Target: Account Recovery Flow (`/account/forgot-password` -> `reset-password`)

| Test ID     | Endpoint                | Payload / Condition          | Expected Result                                            |
| :---------- | :---------------------- | :--------------------------- | :--------------------------------------------------------- |
| `IT-REC-01` | `POST /forgot-password` | Non-existent email           | `200 OK`, renders form with `error_message`                |
| `IT-REC-02` | `POST /forgot-password` | Existing email               | `200 OK` (renders verify OTP view), `sendMail` mock called |
| `IT-REC-03` | `POST /reset-password`  | Valid email, passwords match | `200 OK` (renders signin), DB password updated             |

---

## 5. Risk Assessment & Refactoring Prerequisites

Because `account.route.js` is a "God Route" with high coupling (identified in the code audit), running these tests will be brittle if the underlying HTML/Handlebars strings change.

**Recommended Testability Refactoring:**

1.  **Extract ReCAPTCHA logic** into a reusable middleware (`middlewares/verifyCaptcha.js`). This allows simple stubbing during integration tests.
2.  **Extract Email formatting** out of the route handlers and into `utils/mailer.js` (e.g., `sendOtpEmail(user, otp)`). This makes it easier to mock the mailer interface with Jest.
