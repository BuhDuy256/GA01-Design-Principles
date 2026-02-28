# Test Plan: Flow 8 - Administration Governance

This document outlines the testing strategy for Flow 8 based on the design flaws identified in the code audit. The goal is to ensure stability, data integrity, and correctness across the administrative management of users, categories, products, and system settings.

## 1. Testing Strategy Overview

Due to the monolithic nature of the route handlers (God Routes) and the presence of direct file system operations alongside database updates, testing will require:

- **Unit Tests:** For isolated database model interactions to ensure baseline functionality of data queries and mutations.
- **Integration Tests (API Level):** The primary focus. We will use Supertest to hit the `/admin/*` endpoints. Special attention is needed to handle file uploads during product creation and to ensure state cleanup between tests.

---

## 2. Unit Testing Plan (Jest)

Business logic and complex operations (like file moving and email sending) are currently embedded inside Express routes. We will initially unit test the Database Models.

### Target: `src/models/user.model.js` (Flow 8 Specifics)

| Test ID     | Method                             | Test Description                             | Expected Result                         |
| :---------- | :--------------------------------- | :------------------------------------------- | :-------------------------------------- |
| `UT-ADM-USR-01` | `loadAllUsers()`               | Load all users for the admin list        | Returns an array of user objects        |
| `UT-ADM-USR-02` | `findById(id)`                     | Find a specific user by their ID             | Returns the user object or `undefined`  |
| `UT-ADM-USR-03` | `add(user)`                        | Insert a new user record                     | Record inserted successfully            |
| `UT-ADM-USR-04` | `update(id, data)`                 | Update an existing user's details            | Record updated successfully             |
| `UT-ADM-USR-05` | `deleteUser(id)`                   | Remove a user from the system                | Record deleted successfully             |

### Target: `src/models/product.model.js` (Flow 8 Specifics)

| Test ID     | Method                                 | Test Description                                     | Expected Result                                    |
| :---------- | :------------------------------------- | :--------------------------------------------------- | :------------------------------------------------- |
| `UT-ADM-PRD-01` | `findAll()`                            | Load all products for the admin list             | Returns an array of product objects                |
| `UT-ADM-PRD-02` | `findByProductIdForAdmin(id)`          | Find a specific product with details for editing | Returns product details or `undefined`             |
| `UT-ADM-PRD-03` | `addProduct(productData)`              | Insert a new product record                          | Record inserted, returns the new product ID        |
| `UT-ADM-PRD-04` | `updateProduct(id, data)`              | Update an existing product's details                 | Record updated successfully                        |
| `UT-ADM-PRD-05` | `deleteProduct(id)`                    | Remove a product from the system                     | Record deleted successfully                        |

### Target: `src/models/category.model.js` (Flow 8 Specifics)

| Test ID     | Method                                 | Test Description                                     | Expected Result                                    |
| :---------- | :------------------------------------- | :--------------------------------------------------- | :------------------------------------------------- |
| `UT-ADM-CAT-01` | `findAll()`                            | Load all categories for the admin list           | Returns an array of category objects               |
| `UT-ADM-CAT-02` | `createCategory(data)`                 | Insert a new category record                         | Record inserted successfully                       |
| `UT-ADM-CAT-03` | `updateCategory(id, data)`             | Update an existing category                          | Record updated successfully                        |
| `UT-ADM-CAT-04` | `deleteCategory(id)`                   | Remove a category (if no associated products)        | Record deleted successfully                        |

### Target: `src/models/systemSetting.model.js`

| Test ID         | Method                           | Test Description                             | Expected Result                                |
| :-------------- | :------------------------------- | :------------------------------------------- | :--------------------------------------------- |
| `UT-ADM-SYS-01` | `getAllSettings()`               | Load all system configuration settings       | Returns an array of key-value setting objects  |
| `UT-ADM-SYS-02` | `updateSetting(key, value)`      | Update a specific setting by its key         | Setting value updated successfully             |

---

## 3. Integration Testing Plan (Supertest + Jest)

These tests will hit the Express router directly. **We must run a clean test database and mock external dependencies (like file system writes and email sends) to prevent side effects and state pollution.**

### Target: Admin User Management (`/admin/users/*`)

| Test ID       | Endpoint                  | Payload / Condition                               | Expected Result                                              |
| :------------ | :------------------------ | :------------------------------------------------ | :----------------------------------------------------------- |
| `IT-ADM-USR-01` | `GET /list`               | Authenticated admin access                        | `200 OK`, renders user list                                  |
| `IT-ADM-USR-02` | `POST /add`               | Valid new user data payload                       | `302 Redirect` to `/admin/users/list`, User added to DB      |
| `IT-ADM-USR-03` | `POST /edit`              | Valid updated user data payload                   | `302 Redirect` to `/admin/users/list`, User updated in DB    |
| `IT-ADM-USR-04` | `POST /reset-password`    | Valid user ID payload                             | `302 Redirect` to `/admin/users/list`, Password hash updated |
| `IT-ADM-USR-05` | `POST /delete`            | Valid user ID payload                             | `302 Redirect` to `/admin/users/list`, User removed from DB  |

### Target: Admin Product Management (`/admin/products/*`)

| Test ID       | Endpoint                  | Payload / Condition                               | Expected Result                                              |
| :------------ | :------------------------ | :------------------------------------------------ | :----------------------------------------------------------- |
| `IT-ADM-PRD-01` | `GET /list`               | Authenticated admin access                        | `200 OK`, renders product list                               |
| `IT-ADM-PRD-02` | `POST /add`               | Valid new product data (mocking file uploads)     | `302 Redirect` to `/admin/products/list`, DB records created |
| `IT-ADM-PRD-03` | `POST /edit`              | Valid updated product data payload                | `302 Redirect` to `/admin/products/list`, Product updated    |
| `IT-ADM-PRD-04` | `POST /delete`            | Valid product ID payload                          | `302 Redirect` to `/admin/products/list`, Product removed    |

### Target: Admin System Settings (`/admin/system/*`)

| Test ID       | Endpoint                  | Payload / Condition                               | Expected Result                                              |
| :------------ | :------------------------ | :------------------------------------------------ | :----------------------------------------------------------- |
| `IT-ADM-SYS-01` | `GET /settings`           | Authenticated admin access                        | `200 OK`, renders settings form                              |
| `IT-ADM-SYS-02` | `POST /settings`          | Valid settings update payload                     | `302 Redirect` to `/admin/system/settings?success=...`       |

---

## 4. Risk Assessment & Refactoring Prerequisites

Because the admin routes suffer from massive God Route patterns, High Coupling, and SRP violations, running these integration tests directly against the current implementation carries risks (e.g., partial database updates during product creation, actual emails being sent during password resets).

**Recommended Testability Refactoring:**

1.  **Extract Services:** Move the business logic from `admin/user.route.js` and `admin/product.route.js` into dedicated service layers (`AdminUserService`, `AdminProductService`). This allows unit-testing the core logic independently of Express and HTTP representations.
2.  **Implement DB Transactions for Products:** In the product `POST /add` handler, the insertion of the product, renaming of files, and insertion of related sub-images must be wrapped in a database transaction (`db.transaction()`). This ensures that if file operations fail, the database isn't left in a partially updated state.
3.  **Abstract File System and Email Services:** The direct use of `fs.renameSync` and the inline HTML `sendMail` calls should be abstracted behind mockable interfaces or service methods. This prevents tests from making physical changes to the disk or attempting to send real emails.
4.  **Global Flash Middleware:** Refactor the repetitive flash message extraction out of the route handlers and into a global middleware to reduce boilerplate and simplify tests.
