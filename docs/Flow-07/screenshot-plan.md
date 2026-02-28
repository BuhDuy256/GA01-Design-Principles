# Screenshot Plan: Flow 7 Refactoring

This document outlines the specific code sections that need to be captured as screenshots to demonstrate the "Before" (technical debt) and "After" (clean code) states of the Flow 7 (Upgrade Lifecycle) refactoring.

## 1. Missing Transactions & SRP Violation (Admin Route)

Demonstrates the route handler acting as a pseudo-service, manually updating two separate tables without a database transaction safeguarding the process.

- **Before Image:**
  - **File:** `auction-web/src/routes/admin/user.route.js`
  - **Target Lines:** `161 - 168` (`POST /upgrade/approve`)
  - **Focus Point:** The sequential calls to `approveUpgradeRequest` and `updateUserRoleToSeller` inside the Express handler without a `db.transaction()` wrapper.
- **After Image:**
  - **File:** `auction-web/src/services/upgrade.service.js`
  - **Target Lines:** The refactored `approveUpgradeRequest` method.
  - **Focus Point:** The logic is now encapsulated in a service and wrapped entirely within a Knex transaction block.

## 2. No Transaction in Upgrade Request (Account Route)

Shows the client-side equivalent of the transaction failure risk, where marking the user's role as pending and creating the request are decoupled operations prone to partial failures.

- **Before Image:**
  - **File:** `auction-web/src/routes/account.route.js`
  - **Target Lines:** `72 - 78` (`POST /request-upgrade`)
  - **Focus Point:** The sequential calls to `markUpgradePending` and `createUpgradeRequest` without a transaction wrapper.
- **After Image:**
  - **File:** `auction-web/src/services/upgrade.service.js`
  - **Target Lines:** The refactored `submitUpgradeRequest(userId)` method.
  - **Focus Point:** Both operations are safely executed within a single database transaction.

## 3. Domain Pollution (YAGNI / God Route)

Visually proves that Flow 7 (Upgrade Lifecycle) was appended directly to the bottom of the generic Admin User CRUD file, polluting the domain of standard user management.

- **Before Image:**
  - **File:** `auction-web/src/routes/admin/user.route.js`
  - **Target Lines:** `157 - 175`
  - **Focus Point:** The presence of `GET /upgrade-requests`, `POST /upgrade/approve`, and `POST /upgrade/reject` co-located with basic user add/delete functions.
- **After Image:**
  - **File:** `auction-web/src/routes/admin/upgrade.route.js`
  - **Target Lines:** The entire file.
  - **Focus Point:** The physical separation of the upgrade workflow into its own dedicated router file, resolving the YAGNI and SRP violations.

---

### Instructions for taking screenshots:

1. Open the file in VS Code or your preferred IDE.
2. Ensure Syntax Highlighting is active.
3. Use a tool like Snipping Tool (Windows) or Snagit to capture the target line numbers.
4. Save the "Before" images _before_ running any refactoring steps defined in the `docs/Flow-07/refactor-plan.md`.
