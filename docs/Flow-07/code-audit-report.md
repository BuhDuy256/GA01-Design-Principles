# Flow 7: Upgrade Lifecycle (Bidder -> Seller) - Code Audit Report

## 1. Violated Design Principles (SOLID, KISS, DRY, YAGNI)

### SOLID Violations

- **Single Responsibility Principle (SRP):**
  - `src/routes/admin/user.route.js` mixes admin user CRUD management (Flow 8) with the upgrade request approval workflow (Flow 7).
  - Business logic orchestration is placed directly inside Express route handlers. For example, `POST /upgrade/approve` manually updates the upgrade request status and then separately updates the user's role. This should be encapsulated in an `UpgradeService`.
- **Dependency Inversion Principle (DIP):**
  - The routes directly depend on the database models (`upgradeRequest.model.js` and `user.model.js`) instead of an abstract service layer enforcing business rules.

### KISS & DRY (Don't Repeat Yourself) Violations

- **Error Handling Duplication:** In `src/routes/account.route.js`, the error block for `POST /request-upgrade` duplicates the fallback render logic found in `PUT /profile`. It directly renders `vwAccount/profile` using `req.session.authUser`, bypassing the database read performed in `GET /profile`. If `POST /request-upgrade` fails, the user might see stale session data.

### YAGNI (You Aren't Gonna Need It)

- **Bloated Admin Route:** The `admin/user.route.js` file handles functionality that spans completely differents domains. Integrating the upgrade request logic here is unnecessary and pollutes standard user CRUD capabilities.

---

## 2. God Route

**File:** `src/routes/admin/user.route.js`

While `account.route.js` acts as a God Route for buyers and sellers, `admin/user.route.js` serves as a God Route for admins. It orchestrates:

1.  User CRUD (List, Add, Edit, Delete)
2.  Password resets with integrated raw HTML email delivery
3.  Upgrade Requests viewing, approval, and rejection (Flow 7)

By handling the upgrade lifecycle alongside core user CRUD, it violates modularity and makes the module difficult to test and maintain safely.

---

## 3. High Coupling & Lack of Data Integrity

- **Route <-> Multiple Models Coupling:** The `POST /request-upgrade` route in `account.route.js` explicitly coordinates two operations: `userModel.markUpgradePending` and `upgradeRequestModel.createUpgradeRequest`.
- **Missing Transactions (High Risk):** In both `POST /request-upgrade` and `POST /upgrade/approve`, multiple models are updated sequentially without database transactions. If the first database call succeeds but the script crashes or the second call fails, the system state becomes inconsistent (e.g., a bidder is given a "Seller" role in the `users` table, but the `upgrade_requests` table remains stuck in "pending").

---

## 4. Lines That Need Screenshots

For presentations or reports, capture the following sections to demonstrate the technical debt:

1.  **Missing Transactions & SRP Violation:**
    - **File:** `src/routes/admin/user.route.js`
    - **Lines:** `161 - 168` (`POST /upgrade/approve`)
    - **Why:** Demonstrates the route handler acting as a pseudo-service, manually updating two separate tables (`approveUpgradeRequest` and `updateUserRoleToSeller`) without a database transaction safeguarding the process.
2.  **No Transaction in Upgrade Request:**
    - **File:** `src/routes/account.route.js`
    - **Lines:** `72 - 78` (`POST /request-upgrade`)
    - **Why:** Shows the client-side equivalent of the transaction failure risk, where marking the user's role/state as pending and creating the request are decoupled operations prone to partial failures.
3.  **Domain Pollution (YAGNI / God Route):**
    - **File:** `src/routes/admin/user.route.js`
    - **Lines:** `157 - 175`
    - **Why:** Visually proves that Flow 7 (Upgrade Lifecycle) was appended directly to the bottom of the generic Admin User CRUD file, rather than being given its own isolated `admin/upgrade.route.js` route.
