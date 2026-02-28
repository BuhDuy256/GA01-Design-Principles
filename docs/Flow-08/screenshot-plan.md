# Screenshot Plan: Flow 8 Refactoring (Administration Governance)

This document outlines the specific code sections that need to be captured as screenshots to demonstrate the "Before" (technical debt) and "After" (clean code) states of the Flow 8 refactoring.

## 1. Missing Transactions & SRP Violation in Product Add (God Route)

Demonstrates the route handler acting as a pseudo-service, manually inserting database records and physically moving file uploads without a database transaction safeguarding the process.

- **Before Image:**
  - **File:** `src/routes/admin/product.route.js`
  - **Target Lines:** `47 - 97` (`POST /add`)
  - **Focus Point:** The sequential calls to `addProduct`, `fs.renameSync` (physical file move), and `addProductImages` inside the Express handler without a `db.transaction()` wrapper.
- **After Image:**
  - **File:** `src/services/admin.product.service.js` (or similar new service)
  - **Target Lines:** The refactored `createProductWithImages` method.
  - **Focus Point:** The DB insertion and file renaming logic is now encapsulated in a service and wrapped entirely within a Knex transaction block. The router file (`admin/product.route.js`) should be shown to be significantly smaller.

## 2. SRP Violation & Hardcoded Email Template

Shows the UI/Email presentation layer polluting the HTTP controller layer, making the route bloated and hard to test.

- **Before Image:**
  - **File:** `src/routes/admin/user.route.js`
  - **Target Lines:** `108 - 134` (`POST /reset-password`)
  - **Focus Point:** The raw HTML string (`<p>Hello ${user.fullname},</p>...`) embedded directly inside the express route handler.
- **After Image:**
  - **File:** `src/services/admin.user.service.js` (or similar new service)
  - **Target Lines:** The refactored `resetUserPassword` method.
  - **Focus Point:** The email generation and sending logic is extracted. The route handler only parses the ID and calls the service.

## 3. DRY Violation (Flash Messages & Session State)

Visually proves the repetitive boilerplate code used to manage temporary session state across multiple admin overview pages.

- **Before Image:**
  - **File:** `src/routes/admin/category.route.js`
  - **Target Lines:** `9 - 14` (`GET /list`)
  - **Focus Point:** The repetitive block extracting `success_message` and `error_message` from the session and then immediately deleting them. (This is identical in `product.route.js` and `user.route.js`).
- **After Image:**
  - **File:** `src/routes/admin/category.route.js` 
  - **Target Lines:** `GET /list` route
  - **Focus Point:** The boilerplate is gone, effectively replaced by a global flash middleware (e.g. `req.flash()` or `res.locals` injection).

## 4. YAGNI Violation (Hardcoded Settings Updates)

Demonstrates inflexible code that requires developer intervention to add new application features.

- **Before Image:**
  - **File:** `src/routes/admin/system.route.js`
  - **Target Lines:** `POST /settings`
  - **Focus Point:** The three hardcoded `await systemSettingModel.updateSetting(...)` calls explicitly demanding specific keys.
- **After Image:**
  - **File:** `src/routes/admin/system.route.js`
  - **Target Lines:** The refactored `POST /settings`.
  - **Focus Point:** A dynamic loop (e.g., `Object.keys(req.body).map(...)`) that can handle any number of settings dynamically without hardcoding.

---

### Instructions for taking screenshots:

1. Open the file in VS Code or your preferred IDE.
2. Ensure Syntax Highlighting is active.
3. Use a tool like Snipping Tool (Windows) or Snagit to capture the target line numbers.
4. Save the "Before" images _before_ running any refactoring steps defined in the `docs/Flow-08/refactor-plan.md`.
