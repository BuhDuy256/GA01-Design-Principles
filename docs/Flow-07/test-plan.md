# Test Plan: Flow 7 - Upgrade Lifecycle (Bidder -> Seller)

This document outlines the testing strategy for Flow 7 based on the design flaws identified in the code audit. The goal is to ensure stability and correctness across the bidder upgrade request and admin approval/rejection workflows.

## 1. Testing Strategy Overview

Due to the lack of a dedicated service layer and database transactions (SRP and transaction coupling violations), testing will require a mix of:

- **Unit Tests:** For isolated database model interactions to ensure queries hit the right tables.
- **Integration Tests (API Level):** The primary focus. We will use Supertest to hit the `/account/request-upgrade` and `/admin/users/upgrade/*` endpoints. Special attention is needed to ensure rollback rules on transaction failures once refactored, but currently, we test the existing "God Route" behavior.

---

## 2. Unit Testing Plan (Jest)

Business logic is currently embedded inside Express routes. We will initially unit test the Database Models to guarantee basic integrity.

### Target: `src/models/upgradeRequest.model.js`

| Test ID     | Method                                 | Test Description                                 | Expected Result                                    |
| :---------- | :------------------------------------- | :----------------------------------------------- | :------------------------------------------------- |
| `UT-UPG-01` | `createUpgradeRequest(bidderId)`       | Insert a new upgrade request for a given user    | Record inserted with 'pending' status by default   |
| `UT-UPG-02` | `findByUserId(bidderId)`               | Find existing request by user ID                 | Returns request object or `undefined`              |
| `UT-UPG-03` | `loadAllUpgradeRequests()`             | Load all requests joined with user data          | Returns array of requests with `fullname`, `email` |
| `UT-UPG-04` | `approveUpgradeRequest(id)`            | Mark request as approved                         | Status updated to 'approved', `updated_at` set     |
| `UT-UPG-05` | `rejectUpgradeRequest(id, admin_note)` | Mark request as rejected with an admin note      | Status updated to 'rejected', `admin_note` saved   |

### Target: `src/models/user.model.js` (Flow 7 Specifics)

| Test ID     | Method                             | Test Description                             | Expected Result                         |
| :---------- | :--------------------------------- | :------------------------------------------- | :-------------------------------------- |
| `UT-USR-10` | `markUpgradePending(id)`           | Flags user as having a pending request       | User record updated appropriately       |
| `UT-USR-11` | `updateUserRoleToSeller(bidderId)` | Promotes a bidder to a seller after approval | User `role` changed from 'BIDDER' to 'SELLER' |

---

## 3. Integration Testing Plan (Supertest + Jest)

These tests will hit the Express router directly. **We must mock database operations or run a clean test database to prevent state pollution across tests.**

### Target: Request Upgrade Flow (`/account/request-upgrade`)

| Test ID     | Endpoint                  | Payload / Condition                               | Expected Result                                       |
| :---------- | :------------------------ | :------------------------------------------------ | :---------------------------------------------------- |
| `IT-REQ-01` | `GET /request-upgrade`    | Authenticated bidder with NO existing request     | `200 OK`, renders form                                |
| `IT-REQ-02` | `GET /request-upgrade`    | Authenticated bidder with an existing request     | `200 OK`, renders form showing pending status         |
| `IT-REQ-03` | `POST /request-upgrade`   | Valid request execution                           | `302 Redirect` to `/account/profile?send-request-upgrade=true` |
| `IT-REQ-04` | `POST /request-upgrade`   | Unauthenticated user access                       | `302 Redirect` to `/account/signin` or `401 Unauthorized` |

### Target: Admin Approval/Rejection Flow (`/admin/users/upgrade/*`)

| Test ID      | Endpoint                    | Payload / Condition                          | Expected Result                                           |
| :----------- | :-------------------------- | :------------------------------------------- | :-------------------------------------------------------- |
| `IT-ADM-01`  | `GET /upgrade-requests`     | Admin viewing list                           | `200 OK`, renders list with multiple requests             |
| `IT-ADM-02`  | `POST /upgrade/approve`     | Valid `id` and `bidder_id` payload           | `302 Redirect` to `/admin/users/upgrade-requests`, User role is 'SELLER' |
| `IT-ADM-03`  | `POST /upgrade/reject`      | Valid `id` and `admin_note` payload          | `302 Redirect` to `/admin/users/upgrade-requests`, Request marked 'rejected' |

---

## 4. Risk Assessment & Refactoring Prerequisites

Because both the buyer-side and admin-side routes suffer from transaction coupling risks (identified in the code audit), running these tests on the current architecture might leave orphaned records if an error occurs mid-request.

**Recommended Testability Refactoring:**

1.  **Extract `UpgradeService`:** Move the dual-model updates from `account.route.js` and `admin/user.route.js` into dedicated service methods (e.g., `UpgradeService.submitRequest`, `UpgradeService.approveRequest`).
2.  **Implement Database Transactions:** Ensure the two database operations (updating user role + updating request status) are wrapped in a single transaction within the service. This allows tests to easily rollback state instead of manually cleaning up multiple tables.
3.  **Route Isolation:** Move the admin upgrade endpoints out of the God Route (`admin/user.route.js`) into a dedicated `admin/upgrade.route.js` file so integration tests don't inadvertently trigger other admin flows.
