# API Endpoints Documentation

This document lists all available endpoints in the Online Auction application.

---

## 🏠 Home Routes

### Base Route: `/`

| Method | Endpoint | Description                                                      | Auth Required |
| ------ | -------- | ---------------------------------------------------------------- | ------------- |
| GET    | `/`      | Homepage - displays top ending, top bids, and top price products | No            |

---

## 👤 Account Routes

### Base Route: `/account`

#### Authentication & Registration

| Method | Endpoint                | Description                              | Auth Required |
| ------ | ----------------------- | ---------------------------------------- | ------------- |
| GET    | `/account/signup`       | Display signup form                      | No            |
| POST   | `/account/signup`       | Create new user account (with reCAPTCHA) | No            |
| GET    | `/account/signin`       | Display signin form                      | No            |
| POST   | `/account/signin`       | User login                               | No            |
| POST   | `/account/logout`       | User logout                              | Yes           |
| GET    | `/account/verify-email` | Display OTP verification page            | No            |
| POST   | `/account/verify-email` | Verify email with OTP                    | No            |
| POST   | `/account/resend-otp`   | Resend verification OTP                  | No            |

#### Password Recovery

| Method | Endpoint                              | Description                      | Auth Required |
| ------ | ------------------------------------- | -------------------------------- | ------------- |
| GET    | `/account/forgot-password`            | Display forgot password form     | No            |
| POST   | `/account/forgot-password`            | Request password reset OTP       | No            |
| POST   | `/account/verify-forgot-password-otp` | Verify password reset OTP        | No            |
| POST   | `/account/resend-forgot-password-otp` | Resend password reset OTP        | No            |
| POST   | `/account/reset-password`             | Reset password with new password | No            |

#### OAuth Authentication

| Method | Endpoint                          | Description                   | Auth Required |
| ------ | --------------------------------- | ----------------------------- | ------------- |
| GET    | `/account/auth/google`            | Initiate Google OAuth login   | No            |
| GET    | `/account/auth/google/callback`   | Google OAuth callback         | No            |
| GET    | `/account/auth/facebook`          | Initiate Facebook OAuth login | No            |
| GET    | `/account/auth/facebook/callback` | Facebook OAuth callback       | No            |
| GET    | `/account/auth/github`            | Initiate GitHub OAuth login   | No            |
| GET    | `/account/auth/github/callback`   | GitHub OAuth callback         | No            |

#### Profile Management

| Method | Endpoint           | Description                   | Auth Required |
| ------ | ------------------ | ----------------------------- | ------------- |
| GET    | `/account/profile` | View user profile             | Yes           |
| PUT    | `/account/profile` | Update user profile           | Yes           |
| GET    | `/account/ratings` | View user ratings and reviews | Yes           |

#### Upgrade to Seller

| Method | Endpoint                   | Description                   | Auth Required |
| ------ | -------------------------- | ----------------------------- | ------------- |
| GET    | `/account/request-upgrade` | Display upgrade request page  | Yes           |
| POST   | `/account/request-upgrade` | Submit seller upgrade request | Yes           |

#### User's Product Lists

| Method | Endpoint                                       | Description                                  | Auth Required |
| ------ | ---------------------------------------------- | -------------------------------------------- | ------------- |
| GET    | `/account/watchlist`                           | View watchlisted products                    | Yes           |
| GET    | `/account/bidding`                             | View products user is currently bidding on   | Yes           |
| GET    | `/account/auctions`                            | View won auctions (pending, sold, cancelled) | Yes           |
| POST   | `/account/won-auctions/:productId/rate-seller` | Rate seller after winning auction            | Yes           |
| PUT    | `/account/won-auctions/:productId/rate-seller` | Edit seller rating                           | Yes           |
| GET    | `/account/seller/products`                     | View seller's products                       | Yes           |
| GET    | `/account/seller/sold-products`                | View seller's sold products                  | Yes           |

---

## 🛍️ Product Routes

### Base Route: `/products`

#### Product Browsing & Search

| Method | Endpoint                           | Description                 | Auth Required |
| ------ | ---------------------------------- | --------------------------- | ------------- |
| GET    | `/products/category`               | Browse products by category | No            |
| GET    | `/products/search`                 | Search products by keywords | No            |
| GET    | `/products/detail`                 | View product details        | No\*          |
| GET    | `/products/bidding-history`        | View bidding history page   | Yes           |
| GET    | `/products/bid-history/:productId` | Get bidding history JSON    | No            |

\*Non-active products require authentication and authorization

#### Product Ratings

| Method | Endpoint                             | Description                | Auth Required |
| ------ | ------------------------------------ | -------------------------- | ------------- |
| GET    | `/products/seller/:sellerId/ratings` | View seller's ratings page | No            |
| GET    | `/products/bidder/:bidderId/ratings` | View bidder's ratings page | No            |

#### Bidding & Watchlist

| Method | Endpoint                    | Description                              | Auth Required |
| ------ | --------------------------- | ---------------------------------------- | ------------- |
| POST   | `/products/watchlist`       | Add product to watchlist                 | Yes           |
| DELETE | `/products/watchlist`       | Remove product from watchlist            | Yes           |
| POST   | `/products/bid`             | Place bid on product (automatic bidding) | Yes           |
| POST   | `/products/buy-now`         | Purchase product at Buy Now price        | Yes           |
| POST   | `/products/reject-bidder`   | Seller rejects a bidder                  | Yes           |
| POST   | `/products/unreject-bidder` | Seller removes bidder from rejected list | Yes           |

#### Comments & Questions

| Method | Endpoint            | Description                         | Auth Required |
| ------ | ------------------- | ----------------------------------- | ------------- |
| POST   | `/products/comment` | Post comment or question on product | Yes           |

#### Order Processing

| Method | Endpoint                                        | Description                          | Auth Required |
| ------ | ----------------------------------------------- | ------------------------------------ | ------------- |
| GET    | `/products/complete-order`                      | View order completion page           | Yes           |
| POST   | `/products/order/upload-images`                 | Upload payment/shipping proof images | Yes           |
| POST   | `/products/order/:orderId/submit-payment`       | Buyer submits payment proof          | Yes           |
| POST   | `/products/order/:orderId/confirm-payment`      | Seller confirms payment              | Yes           |
| POST   | `/products/order/:orderId/submit-shipping`      | Seller submits shipping info         | Yes           |
| POST   | `/products/order/:orderId/confirm-delivery`     | Buyer confirms delivery              | Yes           |
| POST   | `/products/order/:orderId/submit-rating`        | Submit rating for transaction        | Yes           |
| POST   | `/products/order/:orderId/complete-transaction` | Complete transaction (skip rating)   | Yes           |

#### Order Chat

| Method | Endpoint                                | Description                 | Auth Required |
| ------ | --------------------------------------- | --------------------------- | ------------- |
| POST   | `/products/order/:orderId/send-message` | Send chat message in order  | Yes           |
| GET    | `/products/order/:orderId/messages`     | Get chat messages for order | Yes           |

---

## 💼 Seller Routes

### Base Route: `/seller`

**Note:** All seller routes require authentication with seller role

#### Dashboard & Product Management

| Method | Endpoint                   | Description                                 |
| ------ | -------------------------- | ------------------------------------------- |
| GET    | `/seller`                  | Seller dashboard with statistics            |
| GET    | `/seller/products`         | View all products (read-only)               |
| GET    | `/seller/products/active`  | View active products (CRUD)                 |
| GET    | `/seller/products/pending` | View pending products (waiting for payment) |
| GET    | `/seller/products/sold`    | View sold products                          |
| GET    | `/seller/products/expired` | View expired products                       |

#### Add Product

| Method | Endpoint                            | Description               |
| ------ | ----------------------------------- | ------------------------- |
| GET    | `/seller/products/add`              | Display add product form  |
| POST   | `/seller/products/add`              | Create new product        |
| POST   | `/seller/products/upload-thumbnail` | Upload product thumbnail  |
| POST   | `/seller/products/upload-subimages` | Upload product sub-images |

#### Update Product

| Method | Endpoint                      | Description                   |
| ------ | ----------------------------- | ----------------------------- |
| POST   | `/seller/products/:id/cancel` | Cancel auction                |
| POST   | `/seller/products/:id/rate`   | Rate bidder after transaction |
| PUT    | `/seller/products/:id/rate`   | Update bidder rating          |

#### Product Description Updates

| Method | Endpoint                                         | Description                       |
| ------ | ------------------------------------------------ | --------------------------------- |
| POST   | `/seller/products/:id/append-description`        | Append new description to product |
| GET    | `/seller/products/:id/description-updates`       | Get all description updates       |
| PUT    | `/seller/products/description-updates/:updateId` | Update a description update       |
| DELETE | `/seller/products/description-updates/:updateId` | Delete a description update       |

---

## 🔧 Admin Routes

### Base Route: `/admin`

**Note:** All admin routes require admin authentication

#### Admin Account

| Method | Endpoint                 | Description        |
| ------ | ------------------------ | ------------------ |
| GET    | `/admin/account/profile` | View admin profile |

### Category Management

#### Base Route: `/admin/categories`

| Method | Endpoint                       | Description                |
| ------ | ------------------------------ | -------------------------- |
| GET    | `/admin/categories/list`       | List all categories        |
| GET    | `/admin/categories/detail/:id` | View category details      |
| GET    | `/admin/categories/add`        | Display add category form  |
| POST   | `/admin/categories/add`        | Create new category        |
| GET    | `/admin/categories/edit/:id`   | Display edit category form |
| POST   | `/admin/categories/edit`       | Update category            |
| POST   | `/admin/categories/delete`     | Delete category            |

### User Management

#### Base Route: `/admin/users`

| Method | Endpoint                      | Description                          |
| ------ | ----------------------------- | ------------------------------------ |
| GET    | `/admin/users/list`           | List all users                       |
| GET    | `/admin/users/detail/:id`     | View user details                    |
| GET    | `/admin/users/add`            | Display add user form                |
| POST   | `/admin/users/add`            | Create new user                      |
| GET    | `/admin/users/edit/:id`       | Display edit user form               |
| POST   | `/admin/users/edit`           | Update user                          |
| POST   | `/admin/users/reset-password` | Reset user password to default (123) |
| POST   | `/admin/users/delete`         | Delete user                          |

#### Seller Upgrade Requests

| Method | Endpoint                        | Description               |
| ------ | ------------------------------- | ------------------------- |
| GET    | `/admin/users/upgrade-requests` | View all upgrade requests |
| POST   | `/admin/users/upgrade/approve`  | Approve upgrade request   |
| POST   | `/admin/users/upgrade/reject`   | Reject upgrade request    |

### Product Management

#### Base Route: `/admin/products`

| Method | Endpoint                           | Description               |
| ------ | ---------------------------------- | ------------------------- |
| GET    | `/admin/products/list`             | List all products         |
| GET    | `/admin/products/detail/:id`       | View product details      |
| GET    | `/admin/products/add`              | Display add product form  |
| POST   | `/admin/products/add`              | Create new product        |
| POST   | `/admin/products/upload-thumbnail` | Upload product thumbnail  |
| POST   | `/admin/products/upload-subimages` | Upload product sub-images |
| GET    | `/admin/products/edit/:id`         | Display edit product form |
| POST   | `/admin/products/edit`             | Update product            |
| POST   | `/admin/products/delete`           | Delete product            |

### System Settings

#### Base Route: `/admin/system`

| Method | Endpoint                 | Description            |
| ------ | ------------------------ | ---------------------- |
| GET    | `/admin/system/settings` | View system settings   |
| POST   | `/admin/system/settings` | Update system settings |

---

## 🔌 API Routes

| Method | Endpoint          | Description                                      | Auth Required |
| ------ | ----------------- | ------------------------------------------------ | ------------- |
| GET    | `/api/categories` | Get all categories with level information (JSON) | No            |

---

## Summary Statistics

- **Total Endpoints:** 130+
- **Public Endpoints:** 25
- **Authenticated User Endpoints:** 50+
- **Seller Endpoints:** 20+
- **Admin Endpoints:** 35+

---

## Authentication Middleware

- `isAuthenticated` - Checks if user is logged in
- `isSeller` - Checks if user has seller role
- `isAdmin` - Checks if user has admin role (automatically applied to all `/admin/*` routes)

---

## Notes

1. **OAuth Providers Supported:** Google, Facebook, GitHub
2. **Auto-bidding:** Implemented on POST `/products/bid`
3. **Auto-extend:** Configured via system settings
4. **Email Notifications:** Sent for various events (bid updates, auction end, payment, shipping, etc.)
5. **Rating System:** Positive (+1), Negative (-1), or Skip (0)
6. **Payment Flow:** Submit Payment → Confirm Payment → Submit Shipping → Confirm Delivery → Rate
7. **Product Status:** ACTIVE, PENDING, SOLD, CANCELLED, EXPIRED
