# Refactoring Plan: Flow 7 - Upgrade Lifecycle (Bidder -> Seller)

Based on the [Code Audit Report](file:///d:/Software%20Engineer/System%20Design/GA01-Design-Principles/docs/Flow-07/code-audit-report.md) and the [Test Plan](file:///d:/Software%20Engineer/System%20Design/GA01-Design-Principles/docs/Flow-07/test-plan.md), this document outlines the step-by-step technical strategy for refactoring the upgrade request flows across the user (`account.route.js`) and admin (`admin/user.route.js`) routes.

The primary goal is to resolve SOLID violations (specifically SRP and YAGNI "God Route" issues), eliminate transaction coupling vulnerabilities, and establish a dedicated Service Layer for the upgrade domain.

---

## Phase 1: Test Coverage (Pre-Refactor)

_Status: Completed_

- Unit tests for `upgradeRequest.model.js` and Flow 7 specific functions in `user.model.js` implemented.
- Integration tests for `/account/request-upgrade` and `/admin/users/upgrade/*` endpoints implemented using Supertest with mocked database (`db.js`).
- _Requirement:_ Ensure all tests pass continuously during the subsequent phases.

---

## Phase 2: Domain Boundary Definition & Route Extraction

**Goal:** Dismantle the God Routes by extracting Flow 7 logic into its own bounded context.

### 2.1 Admin Upgrade Route

- **Action:** Remove the `/upgrade-requests`, `/upgrade/approve`, and `/upgrade/reject` endpoints from `src/routes/admin/user.route.js`.
- **Result:** Create `src/routes/admin/upgrade.route.js`.
- **Benefit:** Resolves the YAGNI/SRP violation in the admin user God Route. `user.route.js` will strictly handle core CRUD operations, while `upgrade.route.js` focuses solely on managing role transitions.

### 2.2 Account Upgrade Route (Optional/Future Proofing)

- **Action:** Evaluate moving `POST /request-upgrade` out of `account.route.js` into a specialized `account.upgrade.route.js`, depending on the ultimate size of the account God Route after Flow 1's refactor. For now, we will focus on extracting its *logic*.

---

## Phase 3: Service Layer Extraction & Transaction Safety

**Goal:** Isolate business rules from Express HTTP Request/Response objects and guarantee data consistency through database transactions.

### 3.1 `UpgradeService` (`services/upgrade.service.js`)

- **Action:** Extract the dual-model update logic from `POST /request-upgrade` and `POST /upgrade/approve`.
- **Methods to create:**
  - `submitUpgradeRequest(userId)`: Handles checking for existing requests, creating the `upgradeRequest` record, and flagging the user as `is_upgrade_pending` **within a single DB transaction**.
  - `approveUpgradeRequest(requestId, adminNote)`: Handles looking up the request, updating its status to 'approved', and promoting the user's role to 'seller' **within a single DB transaction**.
  - `rejectUpgradeRequest(requestId, adminNote)`: Handles updating the request status to 'rejected' and clearing the user's pending flag.
- **Benefit:** 
  - **SRP:** The Express routes become thin controllers, only parsing requests and returning views/redirects.
  - **Data Integrity:** Resolves the high-risk transaction coupling identified in the audit. If a database failure occurs midway through an approval, the system state rolls back cleanly preventing orphaned states.

---

## Phase 4: Verification & Route Restructuring

- Update `src/routes/admin/index.js` (or the main `index.js`) to mount the new `/admin/users/upgrade` (or simply `/admin/upgrades`) router.
- Inject the new `UpgradeService` into the route handlers.
- Run the test suites (Unit + Integration).
- Manually verify the UI navigation for submitting and approving upgrade requests.
- Confirm the code lines flagged in the audit report (missing transactions, domain pollution) are successfully mitigated.
