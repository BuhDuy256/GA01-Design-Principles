# 🛡️ Snapshot Testing Guide - Characterization Tests for Refactoring Safety

## Overview

This guide explains how to use the snapshot tests in `account.route.snapshot.test.js` as a **safety net** before your major refactoring project.

## Purpose

These tests capture the **current behavior** (baseline) of all account routes. After refactoring (extracting services, moving routes to different files), you can run these tests to ensure the application behavior remains **identical**.

## What's Covered

### ✅ All 28 Account Endpoints Tested

- **Authentication & Registration** (8 endpoints)
  - Signup, Signin, Logout
  - Email verification with OTP
  - OTP resending

- **Password Recovery** (5 endpoints)
  - Forgot password flow
  - OTP verification
  - Password reset

- **OAuth Authentication** (6 endpoints)
  - Google, Facebook, GitHub OAuth flows
  - OAuth callbacks

- **Profile Management** (3 endpoints)
  - View profile
  - Update profile (with password change support)
  - View ratings

- **Upgrade to Seller** (2 endpoints)
  - Request upgrade
  - Submit upgrade request

- **User's Product Lists** (7 endpoints)
  - Watchlist
  - Bidding products
  - Won auctions
  - Rate seller (POST/PUT)
  - Seller's products pages

### 📸 What's Captured in Snapshots

1. **Response Status Codes** - HTTP status for every scenario
2. **Full HTML Content** - Complete rendered pages
3. **Redirect Locations** - Where users get redirected (302 responses)
4. **Email Content** - What emails are sent (args passed to mailer)
5. **Database Calls** - What data is being created/updated

## Key Features

### 🎯 Deterministic Mocking

All tests use **fixed, deterministic values** to prevent snapshot changes:

- ✅ **Fixed Date/Time**: `2024-01-01 00:00:00 UTC`
- ✅ **Fixed OTP Codes**: `223456`, `334567`, etc.
- ✅ **Fixed User IDs**: Consistent test user data
- ✅ **Mocked bcrypt**: Predictable password hashing
- ✅ **Mocked Mailer**: No real emails sent
- ✅ **Mocked Database**: Hardcoded responses

### 🔒 Test Scenarios

Each endpoint is tested for:

- ✅ **Success Paths** - Valid data, authenticated users
- ✅ **Error Paths** - Invalid data, validation failures
- ✅ **Authorization** - Unauthenticated access attempts
- ✅ **Edge Cases** - Missing params, expired OTPs, duplicate emails

## Usage Workflow

### Phase 1: Capture Baseline (BEFORE Refactoring)

```bash
# Run snapshot tests to create baseline
cd src
npm test -- account.route.snapshot.test.js

# This creates __snapshots__/ folder with initial snapshots
```

✅ **All tests should pass** - This establishes your baseline

### Phase 2: Refactor Your Code

Now you can safely refactor:

1. **Extract business logic into Services**

   ```javascript
   // BEFORE: Logic in route
   router.post("/signup", async (req, res) => {
     // ... 50 lines of logic ...
   });

   // AFTER: Logic in service
   router.post("/signup", async (req, res) => {
     const result = await AuthService.signup(req.body);
     // ... render result ...
   });
   ```

2. **Move routes to new files**

   ```javascript
   // BEFORE: account.route.js (725 lines)

   // AFTER: Split into multiple files
   // - account/auth.route.js
   // - account/profile.route.js
   // - account/seller.route.js
   ```

3. **Reorganize folder structure**

### Phase 3: Verify No Behavior Changed

```bash
# Run snapshot tests again
npm test -- account.route.snapshot.test.js
```

✅ **Expected Result**: All tests pass without snapshot changes

❌ **If tests fail**:

- Review the snapshot diff carefully
- If changes are intentional (e.g., improved error message), update snapshots
- If changes are unintentional, you've caught a regression! 🎉

### Updating Snapshots (When Intentional Changes Made)

If you **intentionally** changed behavior:

```bash
# Update snapshots to new baseline
npm test -- account.route.snapshot.test.js -u
```

⚠️ **Warning**: Only update snapshots if you're **sure** the changes are correct!

## Test Data Reference

### Mock Users

```javascript
mockDb.users = {
  regularUser: {
    id: 1,
    email: "user@test.com",
    password: "password123"(hashed),
    role: "bidder",
    email_verified: true,
  },

  unverifiedUser: {
    id: 2,
    email: "unverified@test.com",
    password: "password123",
    email_verified: false,
  },

  sellerUser: {
    id: 3,
    email: "seller@test.com",
    role: "seller",
  },

  oauthUser: {
    id: 4,
    email: "oauth@test.com",
    oauth_provider: "google",
  },
};
```

### Mock OTP Codes

- Email verification: `223456`
- Password reset: `334567`
- Expiry: 15 minutes from fixed date

## Best Practices

### ✅ DO

- Run tests **before** starting refactoring
- Run tests **frequently** during refactoring
- Review snapshot diffs carefully
- Use absolute URLs in tests (already done)
- Keep mocks deterministic

### ❌ DON'T

- Update snapshots without reviewing diffs
- Skip tests during refactoring
- Modify test data without good reason
- Remove tests to make them "pass"

## Troubleshooting

### Problem: "Cannot find module '../routes/account.route.js'"

**Solution**: Route file moved? Update import path in test file.

### Problem: Snapshots keep changing on every run

**Cause**: Non-deterministic data (timestamps, random values)

**Solution**: All randoms are mocked - check if new random sources added

### Problem: Test times out

**Cause**: Database connection or async operation not mocked

**Solution**: Ensure all external dependencies are mocked

## Coverage Report

Run with coverage to see what's tested:

```bash
npm test -- account.route.snapshot.test.js --coverage
```

Expected coverage:

- Account routes: ~95%+
- Includes success, error, and auth scenarios

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Characterization Tests
  run: npm test -- account.route.snapshot.test.js

- name: Check for unexpected snapshot changes
  run: git diff --exit-code **/__snapshots__/
```

This prevents accidental behavior changes from being merged.

## Next Steps After Refactoring

Once refactoring is complete and all snapshot tests pass:

1. ✅ Keep these tests as regression tests
2. ✅ Add new unit tests for extracted services
3. ✅ Add integration tests for complex workflows
4. ✅ Consider adding E2E tests for critical user flows

## Questions?

If snapshot tests fail after refactoring:

1. Check the diff carefully - what changed?
2. Is it intentional (bug fix, feature) or unintentional (regression)?
3. If intentional: Update snapshot with `-u` flag
4. If unintentional: Debug the issue before updating snapshots

---

**Remember**: These tests are your safety net. Trust them, but verify changes before updating snapshots! 🛡️
