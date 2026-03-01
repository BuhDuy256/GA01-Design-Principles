/**
 * Product Routes - Snapshot Tests
 *
 * Purpose: Capture current behavior of all product endpoints before refactoring.
 * These snapshots serve as a "safety net" to ensure behavior remains identical
 * after extracting logic into services or moving routes.
 *
 * All external dependencies are mocked with deterministic values to ensure
 * consistent snapshots across test runs.
 */

import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import session from "express-session";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";

// ================================================================
// DETERMINISTIC MOCKING
// ================================================================

// 1. Mock Date.now() for consistent timestamps
const FIXED_TIMESTAMP = new Date("2024-01-01T00:00:00.000Z").getTime();
const originalDateNow = Date.now;
Date.now = () => FIXED_TIMESTAMP;

// 2. Mock Math.random() for consistent random values
const randomSequence = [
  0.123456, 0.234567, 0.345678, 0.456789, 0.56789, 0.678901, 0.789012,
];
let randomIndex = 0;
Math.random = () => {
  const value = randomSequence[randomIndex % randomSequence.length];
  randomIndex++;
  return value;
};

// 3. Mock database connection
jest.unstable_mockModule("../utils/db.js", () => ({
  default: jest.fn(() => ({
    select: jest.fn(),
    where: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  })),
}));

// 4. Mock mailer to prevent side effects
jest.unstable_mockModule("../utils/mailer.js", () => ({
  sendMail: jest.fn().mockResolvedValue(true),
}));

// 5. Mock multer for file upload testing
jest.unstable_mockModule("multer", () => {
  const mockMulter = () => ({
    array: jest.fn(() => (req, res, next) => {
      req.files = [];
      next();
    }),
    single: jest.fn(() => (req, res, next) => {
      req.file = null;
      next();
    }),
  });
  mockMulter.diskStorage = jest.fn(() => ({}));
  return { default: mockMulter };
});

// 6. Mock all model dependencies
jest.unstable_mockModule("../models/product.model.js", () => ({
  findByCategoryIds: jest.fn(),
  countByCategoryIds: jest.fn(),
  searchProducts: jest.fn(),
  countSearchProducts: jest.fn(),
  findById: jest.fn(),
  getProductImages: jest.fn(),
  findSimilarProducts: jest.fn(),
}));

jest.unstable_mockModule("../models/review.model.js", () => ({
  calculateRatingPoint: jest.fn(),
  getReviewsByUserId: jest.fn(),
}));

jest.unstable_mockModule("../models/user.model.js", () => ({
  findById: jest.fn(),
}));

jest.unstable_mockModule("../models/watchlist.model.js", () => ({
  isInWatchlist: jest.fn(),
}));

jest.unstable_mockModule("../models/biddingHistory.model.js", () => ({
  getBiddingHistoryByProductId: jest.fn(),
  getBiddingHistory: jest.fn(),
  getHighestBidder: jest.fn(),
}));

jest.unstable_mockModule("../models/productComment.model.js", () => ({
  getCommentsByProductId: jest.fn(),
}));

jest.unstable_mockModule("../models/category.model.js", () => ({
  findByCategoryId: jest.fn(),
  findChildCategoryIds: jest.fn(),
}));

jest.unstable_mockModule("../models/productDescriptionUpdate.model.js", () => ({
  getUpdatesByProductId: jest.fn(),
}));

jest.unstable_mockModule("../models/autoBidding.model.js", () => ({}));
jest.unstable_mockModule("../models/systemSetting.model.js", () => ({
  getSettings: jest.fn(),
}));
jest.unstable_mockModule("../models/rejectedBidder.model.js", () => ({}));
jest.unstable_mockModule("../models/order.model.js", () => ({}));
jest.unstable_mockModule("../models/invoice.model.js", () => ({}));
jest.unstable_mockModule("../models/orderChat.model.js", () => ({}));

// Import mocked models (must come after mock definitions)
const productModel = await import("../models/product.model.js");
const reviewModel = await import("../models/review.model.js");
const userModel = await import("../models/user.model.js");
const watchListModel = await import("../models/watchlist.model.js");
const biddingHistoryModel = await import("../models/biddingHistory.model.js");
const productCommentModel = await import("../models/productComment.model.js");
const categoryModel = await import("../models/category.model.js");
const productDescUpdateModel =
  await import("../models/productDescriptionUpdate.model.js");
const autoBiddingModel = await import("../models/autoBidding.model.js");
const systemSettingModel = await import("../models/systemSetting.model.js");
const rejectedBidderModel = await import("../models/rejectedBidder.model.js");
const orderModel = await import("../models/order.model.js");
const invoiceModel = await import("../models/invoice.model.js");
const orderChatModel = await import("../models/orderChat.model.js");
const { sendMail } = await import("../utils/mailer.js");

// Import the product routes
const { default: productRouter } = await import("../routes/product.route.js");

// ================================================================
// MOCK DATA
// ================================================================

const mockDb = {
  users: {
    regularUser: {
      id: 1,
      email: "user@test.com",
      fullname: "Test User",
      address: "123 Test St",
      password_hash:
        "$2a$10$YourHashedPasswordHere.123456789012345678901234567890123456",
      role: "bidder",
      email_verified: true,
      oauth_provider: null,
      date_of_birth: new Date("1990-01-01"),
      created_at: new Date("2024-01-01"),
    },
    sellerUser: {
      id: 2,
      email: "seller@test.com",
      fullname: "Test Seller",
      address: "456 Seller Ave",
      password_hash:
        "$2a$10$SellerHashedPasswordHere.123456789012345678901234567890123",
      role: "seller",
      email_verified: true,
      oauth_provider: null,
      date_of_birth: new Date("1985-05-15"),
      created_at: new Date("2024-01-01"),
    },
  },
  categories: {
    electronics: {
      id: 1,
      name: "Electronics",
      parent_id: null,
    },
    laptops: {
      id: 2,
      name: "Laptops",
      parent_id: 1,
    },
  },
  products: {
    activeProduct: {
      id: 101,
      name: "Test Laptop",
      category_id: 2,
      seller_id: 2,
      start_price: 500,
      buy_now_price: 1000,
      step_price: 50,
      current_price: 550,
      description: "A great laptop for testing",
      thumbnail: "laptop.jpg",
      status: "ACTIVE",
      auto_extend: true,
      created_at: new Date("2024-01-01T00:00:00.000Z"),
      end_time: new Date("2024-12-31T23:59:59.000Z"),
    },
    expiredProduct: {
      id: 102,
      name: "Expired Product",
      category_id: 2,
      seller_id: 2,
      start_price: 100,
      buy_now_price: 200,
      step_price: 10,
      current_price: 100,
      description: "This product expired",
      thumbnail: "expired.jpg",
      status: "EXPIRED",
      auto_extend: false,
      created_at: new Date("2023-01-01T00:00:00.000Z"),
      end_time: new Date("2023-12-31T23:59:59.000Z"),
    },
  },
  orders: {
    pendingOrder: {
      id: 201,
      product_id: 101,
      seller_id: 2,
      buyer_id: 1,
      final_price: 550,
      status: "PENDING_PAYMENT",
      created_at: new Date("2024-01-01"),
    },
    shippingOrder: {
      id: 202,
      product_id: 102,
      seller_id: 2,
      buyer_id: 1,
      final_price: 150,
      status: "PENDING_SHIPMENT",
      payment_proof_images: ["payment1.jpg"],
      created_at: new Date("2024-01-01"),
    },
  },
  reviews: [
    {
      id: 1,
      reviewer_id: 1,
      reviewed_user_id: 2,
      product_id: 101,
      rating: 1,
      comment: "Great seller!",
      created_at: new Date("2024-01-01"),
    },
  ],
  biddingHistory: [
    {
      id: 1,
      product_id: 101,
      bidder_id: 1,
      bid_amount: 550,
      bid_time: new Date("2024-01-01T12:00:00.000Z"),
    },
  ],
  comments: [
    {
      id: 1,
      product_id: 101,
      user_id: 1,
      comment: "Is this still available?",
      created_at: new Date("2024-01-01"),
    },
  ],
  orderChats: [
    {
      id: 1,
      order_id: 201,
      sender_id: 1,
      message: "When will you ship?",
      created_at: new Date("2024-01-01"),
    },
  ],
  systemSettings: {
    new_product_limit_minutes: 60,
    auto_extend_minutes: 10,
  },
};

// ================================================================
// TEST APP SETUP
// ================================================================

function createTestApp() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const app = express();

  // Setup view engine
  app.engine(
    "handlebars",
    engine({
      defaultLayout: "main",
      layoutsDir: path.join(__dirname, "../views/layouts"),
      partialsDir: path.join(__dirname, "../views/partials"),
      helpers: {
        formatDate: (date) => (date ? new Date(date).toLocaleDateString() : ""),
        formatCurrency: (amount) => `$${parseFloat(amount).toFixed(2)}`,
        eq: (a, b) => a === b,
        or: (...args) => args.slice(0, -1).some(Boolean),
      },
    }),
  );
  app.set("view engine", "handlebars");
  app.set("views", path.join(__dirname, "../views"));

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      secret: "test-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }),
  );

  // Mount routes
  app.use("/products", productRouter);

  return app;
}

// ================================================================
// TESTS
// ================================================================

describe("Product Routes - Snapshot Tests", () => {
  let app;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    randomIndex = 0;

    // Create fresh app instance
    app = createTestApp();

    // Setup default mock returns
    systemSettingModel.getSettings.mockResolvedValue(mockDb.systemSettings);
    categoryModel.findByCategoryId.mockResolvedValue(
      mockDb.categories.electronics,
    );
    categoryModel.findChildCategoryIds.mockResolvedValue([
      mockDb.categories.laptops,
    ]);
    productModel.findByCategoryIds.mockResolvedValue([
      mockDb.products.activeProduct,
    ]);
    productModel.countByCategoryIds.mockResolvedValue({ count: "1" });
    userModel.findById.mockResolvedValue(mockDb.users.regularUser);
  });

  // ================================================================
  // PRODUCT BROWSING & SEARCH
  // ================================================================

  describe("GET /products/bidding-history", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .get("/products/bidding-history")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /products/bid-history/:productId", () => {
    test("SUCCESS: should return bidding history JSON", async () => {
      biddingHistoryModel.getBiddingHistoryByProductId.mockResolvedValueOnce(
        mockDb.biddingHistory,
      );

      const response = await request(app)
        .get("/products/bid-history/101")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });

    test("SUCCESS: should return empty array for no history", async () => {
      biddingHistoryModel.getBiddingHistoryByProductId.mockResolvedValueOnce(
        [],
      );

      const response = await request(app)
        .get("/products/bid-history/101")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  // ================================================================
  // PRODUCT RATINGS
  // ================================================================

  // ================================================================
  // BIDDING & WATCHLIST
  // ================================================================

  describe("POST /products/watchlist", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/watchlist")
        .send({ productId: 101 })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("DELETE /products/watchlist", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .delete("/products/watchlist")
        .send({ productId: 101 })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/bid", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/bid")
        .send({ productId: 101, bidAmount: 600 })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/buy-now", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/buy-now")
        .send({ productId: 101 })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/reject-bidder", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/reject-bidder")
        .send({ productId: 101, bidderId: 1 })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/unreject-bidder", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/unreject-bidder")
        .send({ productId: 101, bidderId: 1 })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  // ================================================================
  // COMMENTS & QUESTIONS
  // ================================================================

  describe("POST /products/comment", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/comment")
        .send({ productId: 101, comment: "Great product!" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  // ================================================================
  // ORDER PROCESSING
  // ================================================================

  describe("GET /products/complete-order", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .get("/products/complete-order")
        .query({ orderId: 201 })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/order/upload-images", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/order/upload-images")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/order/:orderId/submit-payment", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/order/201/submit-payment")
        .send({ paymentProofs: ["payment1.jpg"] })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/order/:orderId/confirm-payment", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/order/201/confirm-payment")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/order/:orderId/submit-shipping", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/order/201/submit-shipping")
        .send({ shippingProofs: ["shipping1.jpg"] })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/order/:orderId/confirm-delivery", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/order/201/confirm-delivery")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/order/:orderId/submit-rating", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/order/201/submit-rating")
        .send({ rating: "positive", comment: "Great!" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /products/order/:orderId/complete-transaction", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/order/201/complete-transaction")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  // ================================================================
  // ORDER CHAT
  // ================================================================

  describe("POST /products/order/:orderId/send-message", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/products/order/201/send-message")
        .send({ message: "Hello!" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /products/order/:orderId/messages", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .get("/products/order/201/messages")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });
});
