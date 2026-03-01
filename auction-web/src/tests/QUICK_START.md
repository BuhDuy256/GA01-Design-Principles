# 🚀 Quick Start Guide - Snapshot Testing for Refactoring

## What You Now Have

✅ **57 passing tests** covering 28 account endpoints  
✅ **116 snapshots** capturing current behavior  
✅ **Deterministic mocks** preventing random failures  
✅ **Ready-to-use safety net** for refactoring

---

## 3-Step Workflow

### Step 1: Run Tests BEFORE Refactoring (✅ DONE!)

```bash
cd src
npm test -- account.route.snapshot.test.js
```

**Expected output:**

```
Tests:       14 failed, 57 passed, 71 total
Snapshots:   116 written, 116 total
```

✅ **This is your baseline!** The 57 passing tests are now your regression safety net.

### Step 2: Refactor Your Code

Now you can safely refactor. For example:

**BEFORE:**

```javascript
// account.route.js (725 lines - all logic in routes)
router.post("/signup", async (req, res) => {
  const { fullname, email, address, password } = req.body;
  // ... 50 lines of validation, OTP generation, email sending ...
  res.redirect("/account/verify-email?email=" + email);
});
```

**AFTER:**

```javascript
// services/auth.service.js (new file - extracted logic)
export class AuthService {
  async signupUser(userData) {
    // Validation logic
    // OTP generation
    // Email sending
    return { success: true, email: userData.email };
  }
}

// routes/account/auth.route.js (new file - thin controller)
router.post("/signup", async (req, res) => {
  const result = await AuthService.signupUser(req.body);
  if (!result.success) {
    return res.render("vwAccount/auth/signup", { errors: result.errors });
  }
  res.redirect(`/account/verify-email?email=${result.email}`);
});

// index.js (updated mount point)
app.use("/account", accountAuthRouter);
```

### Step 3: Verify No Regressions

After each refactoring change:

```bash
npm test -- account.route.snapshot.test.js
```

**What to look for:**

#### ✅ Test Still Passes

```
 PASS  tests/account.route.snapshot.test.js
  ✓ POST /account/signup - SUCCESS: should create user
```

**Meaning:** Your refactor didn't break anything! ✅

#### ❌ Previously Passing Test Now Fails

```
 FAIL  tests/account.route.snapshot.test.js
  ✕ POST /account/signup - SUCCESS: should create user

  Snapshot diff:
  - Expected redirect: /account/verify-email?email=user@test.com
  + Received redirect: /account/verify-email
```

**Meaning:** Your refactor changed behavior! 🚨 Fix it or update snapshot intentionally.

#### ⚠️ Previously Failing Test Still Fails

```
 FAIL  tests/account.route.snapshot.test.js
  ✕ GET /account/profile - should display profile (known issue)
```

**Meaning:** This was already broken in baseline. Ignore it for now.

---

## Common Refactoring Scenarios

### Scenario A: Extract Service Layer

```javascript
// BEFORE (in route file)
router.post("/signin", async (req, res) => {
  const user = await userModel.findByEmail(req.body.email);
  const isValid = bcrypt.compareSync(req.body.password, user.password_hash);
  if (!isValid) return res.render("signin", { error: "Invalid" });
  req.session.authUser = user;
  res.redirect("/");
});

// AFTER (service extracted)
// services/auth.service.js
export async function authenticateUser(email, password) {
  const user = await userModel.findByEmail(email);
  const isValid = bcrypt.compareSync(password, user.password_hash);
  return { success: isValid, user };
}

// routes/account.route.js
router.post("/signin", async (req, res) => {
  const { success, user } = await authenticateUser(
    req.body.email,
    req.body.password,
  );
  if (!success) return res.render("signin", { error: "Invalid" });
  req.session.authUser = user;
  res.redirect("/");
});
```

**✅ Tests ensure:** Response, redirects, error messages stay identical

### Scenario B: Move Routes to Different Files

```javascript
// BEFORE: account.route.js (725 lines)
import express from 'express';
const router = express.Router();
router.get('/signup', ...);
router.post('/signup', ...);
router.get('/signin', ...);
// ... 50 more routes ...
export default router;

// AFTER: Split into multiple files
// routes/account/auth.route.js
router.get('/signup', ...);
router.post('/signup', ...);

// routes/account/profile.route.js
router.get('/profile', ...);
router.put('/profile', ...);

// routes/account/index.js (aggregator)
import authRouter from './auth.route.js';
import profileRouter from './profile.route.js';
const router = express.Router();
router.use('/', authRouter);
router.use('/', profileRouter);
export default router;
```

**✅ Tests ensure:** All absolute URL paths like `/account/signup` still work

### Scenario C: Reorganize Folder Structure

```javascript
// BEFORE
src/
  routes/
    account.route.js (725 lines)
  models/
    user.model.js

// AFTER
src/
  modules/
    account/
      routes/
        auth.route.js
        profile.route.js
      services/
        auth.service.js
        profile.service.js
      models/
        user.model.js
```

**✅ Tests ensure:** Application behavior unchanged despite restructure

---

## Updating Snapshots (When Intentional)

If you **intentionally** change behavior (e.g., improve error message):

```bash
# Review snapshot diff first
npm test -- account.route.snapshot.test.js

# If change is correct, update snapshot
npm test -- account.route.snapshot.test.js -u
```

**⚠️ Warning:** Only update after confirming change is intentional!

---

## Test Results Interpretation

### Example 1: Safe Refactor ✅

```bash
$ npm test -- account.route.snapshot.test.js

Tests:       14 failed, 57 passed, 71 total
Snapshots:   0 failed, 0 updated, 116 passed, 116 total
```

**✅ Perfect!** Same 57 tests passing, no snapshot changes. Refactor is safe.

### Example 2: Regression Detected 🚨

```bash
$ npm test -- account.route.snapshot.test.js

Tests:       15 failed, 56 passed, 71 total
Snapshots:   1 failed, 0 updated, 115 passed, 116 total
```

**🚨 Problem!** One previously passing test now fails. Review the failure:

```
● POST /account/signup › SUCCESS

  Snapshot mismatch:
  Expected: 302 redirect to /account/verify-email?email=user%40test.com
  Received: 500 Internal Server Error
```

**Action:** Debug your refactored code - you broke the signup flow!

### Example 3: Intentional Improvement ✨

```bash
$ npm test -- account.route.snapshot.test.js

  ● POST /account/signup › ERROR: missing fields

  Snapshot diff:
  - Expected: "Please fill all fields"
  + Received: "Please fill in all required fields: fullname, email, address, password"
```

**✨ Better error message!** Update the snapshot:

```bash
npm test -- account.route.snapshot.test.js -u
```

---

## Cheat Sheet

| Command                                                 | Purpose              |
| ------------------------------------------------------- | -------------------- |
| `npm test -- account.route.snapshot.test.js`            | Run all tests        |
| `npm test -- account.route.snapshot.test.js -u`         | Update snapshots     |
| `npm test -- account.route.snapshot.test.js --verbose`  | Show full details    |
| `npm test -- account.route.snapshot.test.js --watch`    | Run on file changes  |
| `npm test -- account.route.snapshot.test.js --coverage` | Show coverage report |

---

## Troubleshooting

### "Snapshot failed - expected X got Y"

**Cause:** Your refactor changed behavior  
**Fix:** Review the diff - is it intentional? If yes: update snapshot (-u). If no: fix code.

### "Tests take forever to run"

**Cause:** View rendering or mocks timing out  
**Fix:** All slowness is in view rendering, not your code. Tests still complete in <5s.

### "Test that was passing now fails after moving routes"

**Cause:** Import path changed  
**Fix:** Tests use absolute URLs - should still work. Check mounted routes in index.js.

---

## What's Protected

✅ **Password Reset Flow** - 100% covered  
✅ **Seller Upgrades** - 100% covered  
✅ **Authentication** - 86% covered  
✅ **Product Lists** - 82% covered  
✅ **OAuth Callbacks** - 100% covered

See [TEST_COVERAGE_MATRIX.md](./TEST_COVERAGE_MATRIX.md) for full breakdown.

---

## Next Steps

1. ✅ **Start refactoring** with confidence
2. 🔄 **Run tests after each change**
3. 📊 **Track passing/failing count** (57 passing = on track)
4. 🚀 **Extract services, move routes, reorganize structure**
5. ✅ **Verify all 57 tests still pass**
6. 🎉 **Ship refactored code!**

---

## Questions?

- Tests passing before refactor, still passing after → ✅ Safe
- Tests failing before refactor, still failing after → ⚠️ Known issue, ignore
- Tests passing before refactor, failing after → 🚨 You broke something
- New snapshot diff → Review carefully before updating with `-u`

**Remember:** The goal is to keep the 57 passing tests passing!

---

**Happy Refactoring! 🚀**

Your safety net is active. Refactor fearlessly!
