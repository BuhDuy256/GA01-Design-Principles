# Test Suite Documentation

This directory contains comprehensive test files for the Online Auction application.

---

## 🛡️ SNAPSHOT TESTS (Characterization/Refactoring Safety)

### **NEW: `account.route.snapshot.test.js`** ⭐

**Purpose:** Safety net for refactoring - captures current behavior baseline

**Status:** ✅ **57/71 tests passing (80%)** | 📸 **116 snapshots captured**

Comprehensive snapshot testing for all 28 account endpoints covering:

- Authentication & Registration (22 tests)
- Password Recovery (10 tests)
- OAuth Authentication (6 tests)
- Profile Management (11 tests)
- Upgrade to Seller (4 tests)
- User Product Lists (17 tests)

**Key Features:**

- ✅ Deterministic mocks (fixed dates, OTPs, user IDs)
- ✅ Captures full HTML, status codes, redirects
- ✅ No database/email side effects
- ✅ Safe to run before/during/after refactoring

**Documentation:**

- 📖 [QUICK_START.md](./QUICK_START.md) - How to use for refactoring
- 📊 [TEST_COVERAGE_MATRIX.md](./TEST_COVERAGE_MATRIX.md) - Which tests pass/fail
- 📋 [SNAPSHOT_TEST_STATUS.md](./SNAPSHOT_TEST_STATUS.md) - Current status & known issues
- 📚 [SNAPSHOT_TESTING_GUIDE.md](./SNAPSHOT_TESTING_GUIDE.md) - Complete guide

**Quick Start:**

```bash
# Run snapshot tests
npm test -- account.route.snapshot.test.js

# Expected: 57 passing, 14 failing (test setup issues, not app bugs)
# You're now protected to refactor!
```

---

## 📝 UNIT TESTS (Original Test Suite)

### 1. `setup.js`

Global test configuration and setup file.

- Configures test environment variables
- Mocks mailer to prevent sending real emails during tests
- Sets global test timeout

### 2. `account-auth.test.js`

Tests for authentication and registration routes.

**Coverage:**

- `GET /account/signup` - Display signup form
- `POST /account/signup` - Create new user account
- `GET /account/signin` - Display signin form
- `POST /account/signin` - User login
- `POST /account/logout` - User logout
- `GET /account/verify-email` - Display OTP verification page
- `POST /account/verify-email` - Verify email with OTP
- `POST /account/resend-otp` - Resend verification OTP

**Test Cases:** 17 tests covering:

- Form display
- Valid/invalid inputs
- Duplicate registrations
- Email verification flow
- OTP expiration
- Session management

### 3. `account-password-recovery.test.js`

Tests for password recovery routes.

**Coverage:**

- `GET /account/forgot-password` - Display forgot password form
- `POST /account/forgot-password` - Request password reset OTP
- `POST /account/verify-forgot-password-otp` - Verify password reset OTP
- `POST /account/resend-forgot-password-otp` - Resend password reset OTP
- `POST /account/reset-password` - Reset password with new password

**Test Cases:** 16 tests covering:

- Password reset flow
- OTP generation and validation
- OTP expiration (15 minutes)
- Password validation
- Token invalidation after use
- Password hashing

### 4. `account-oauth.test.js`

Tests for OAuth authentication routes.

**Coverage:**

- `GET /account/auth/google` - Initiate Google OAuth login
- `GET /account/auth/google/callback` - Google OAuth callback
- `GET /account/auth/facebook` - Initiate Facebook OAuth login
- `GET /account/auth/facebook/callback` - Facebook OAuth callback
- `GET /account/auth/github` - Initiate GitHub OAuth login
- `GET /account/auth/github/callback` - GitHub OAuth callback

**Test Cases:** 18 tests covering:

- OAuth flow initiation
- Callback handling
- Error handling
- Account merging
- Multiple OAuth providers
- Session creation

### 5. `account-profile-lists.test.js`

Tests for profile management and user product lists routes.

**Coverage:**

- `GET /account/profile` - View user profile
- `PUT /account/profile` - Update user profile
- `GET /account/ratings` - View user ratings and reviews
- `GET /account/request-upgrade` - Display upgrade request page
- `POST /account/request-upgrade` - Submit seller upgrade request
- `GET /account/watchlist` - View watchlisted products
- `GET /account/bidding` - View products user is bidding on
- `GET /account/auctions` - View won auctions
- `POST /account/won-auctions/:productId/rate-seller` - Rate seller
- `PUT /account/won-auctions/:productId/rate-seller` - Edit seller rating
- `GET /account/seller/products` - View seller's products
- `GET /account/seller/sold-products` - View seller's sold products

**Test Cases:** 31 tests covering:

- Profile CRUD operations
- Authentication requirements
- Rating system (+1, -1, 0)
- Seller upgrade flow
- Watchlist functionality
- Auction participation tracking
- Seller-specific features

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run tests with coverage

```bash
npm run test:coverage
```

### Run specific test file

```bash
npm test -- account-auth.test.js
```

## Test Statistics

- **Total Test Files:** 5 (including setup)
- **Total Test Cases:** 82+
- **Endpoints Covered:** 25+ account-related endpoints
- **Test Types:**
  - Integration tests (API endpoints)
  - Authentication/Authorization tests
  - Form validation tests
  - OAuth flow tests
  - Database interaction tests (mocked)

## Dependencies

- **Jest** - Testing framework
- **Supertest** - HTTP assertions
- **Express** - Web framework (under test)
- **Express-session** - Session management

## Notes

### Test Environment

- Tests use mocked database connections
- Email sending is mocked to prevent actual emails
- Sessions are configured for testing (secure: false)
- reCAPTCHA is mocked during tests

### Authentication Testing

Many tests require authenticated sessions. The test suite includes helper functions to create authenticated agents for testing protected routes.

### Database Mocking

Tests assume certain data exists in the database. For complete integration tests, you may need to:

1. Set up a test database
2. Seed test data before running tests
3. Clean up after tests complete

### Known Limitations

- Some tests check for status codes without full integration with the database
- OAuth tests may require additional mocking of passport strategies
- E-mail OTP verification requires database integration for full testing

## Future Improvements

1. **Database Integration**
   - Add test database setup/teardown
   - Implement data seeding for consistent test states

2. **Mock Improvements**
   - Mock passport strategies for OAuth testing
   - Mock reCAPTCHA validation

3. **Additional Coverage**
   - Test concurrent session handling
   - Test rate limiting on authentication endpoints
   - Test SQL injection prevention

4. **Performance Tests**
   - Add load testing for authentication endpoints
   - Test session storage scalability

## Contributing

When adding new account routes:

1. Add corresponding tests to the appropriate test file
2. Update this README with new coverage information
3. Ensure all tests pass before committing
4. Maintain at least 80% code coverage

## Test Writing Guidelines

- Use descriptive test names that explain what is being tested
- Test both success and failure cases
- Test edge cases (empty inputs, malformed data, etc.)
- Mock external dependencies (email, database, OAuth providers)
- Keep tests isolated and independent
- Use `beforeAll` for setup and `afterAll` for cleanup
