/**
 * Seller Routes - Comprehensive Snapshot Tests
 *
 * Purpose: Characterization testing to establish a baseline before refactoring
 * Approach: Capture full HTML/JSON responses with deterministic mocking
 * Scope: All 17 seller endpoints with authentication scenarios
 */

import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import expressSession from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { create } from "express-handlebars";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================================================
// DETERMINISTIC MOCKING
// ================================================================

// Mock Date for consistent timestamps
const MOCK_DATE = new Date("2024-01-01T00:00:00.000Z");
global.Date.now = jest.fn(() => MOCK_DATE.getTime());

// Mock Math.random for consistent multer filenames
let randomCallCount = 0;
const mockRandomSequence = [0.123456789, 0.987654321, 0.555555555, 0.111111111];
global.Math.random = jest.fn(
  () => mockRandomSequence[randomCallCount++ % mockRandomSequence.length],
);

// Mock db module
jest.unstable_mockModule("../utils/db.js", () => ({
  default: jest.fn(),
}));

// Mock mailer module
jest.unstable_mockModule("../utils/mailer.js", () => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: "mock-email-id" }),
}));

// Mock multer with diskStorage
const multerMock = jest.fn((options) => ({
  single: jest.fn((fieldName) => (req, res, next) => {
    req.file = {
      fieldname: fieldName,
      originalname: "test-thumbnail.jpg",
      encoding: "7bit",
      mimetype: "image/jpeg",
      destination: "public/uploads/",
      filename: "1704067200000-123456789-test-thumbnail.jpg",
      path: "public/uploads/1704067200000-123456789-test-thumbnail.jpg",
      size: 50000,
    };
    next();
  }),
  array: jest.fn((fieldName, maxCount) => (req, res, next) => {
    req.files = [
      {
        fieldname: fieldName,
        originalname: "test-image-1.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        destination: "public/uploads/",
        filename: "1704067200000-987654321-test-image-1.jpg",
        path: "public/uploads/1704067200000-987654321-test-image-1.jpg",
        size: 45000,
      },
      {
        fieldname: fieldName,
        originalname: "test-image-2.jpg",
        encoding: "7bit",
        mimetype: "image/jpeg",
        destination: "public/uploads/",
        filename: "1704067200000-555555555-test-image-2.jpg",
        path: "public/uploads/1704067200000-555555555-test-image-2.jpg",
        size: 48000,
      },
    ];
    next();
  }),
}));

multerMock.diskStorage = jest.fn((options) => ({}));

jest.unstable_mockModule("multer", () => ({
  default: multerMock,
}));

// Mock fs module for file operations
jest.unstable_mockModule("fs", () => ({
  default: {
    renameSync: jest.fn(),
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
  },
}));

// Mock all product model functions
jest.unstable_mockModule("../models/product.model.js", () => ({
  getSellerStats: jest.fn(),
  findAllProductsBySellerId: jest.fn(),
  findActiveProductsBySellerId: jest.fn(),
  findPendingProductsBySellerId: jest.fn(),
  getPendingProductsStats: jest.fn(),
  findSoldProductsBySellerId: jest.fn(),
  getSoldProductsStats: jest.fn(),
  findExpiredProductsBySellerId: jest.fn(),
  addProduct: jest.fn(),
  updateProductThumbnail: jest.fn(),
  addProductImages: jest.fn(),
  cancelProduct: jest.fn(),
  findByProductId2: jest.fn(),
}));

// Mock review model functions
jest.unstable_mockModule("../models/review.model.js", () => ({
  getProductReview: jest.fn(),
  findByReviewerAndProduct: jest.fn(),
  createReview: jest.fn(),
  updateByReviewerAndProduct: jest.fn(),
  updateReview: jest.fn(),
}));

// Mock product description update model functions
jest.unstable_mockModule("../models/productDescriptionUpdate.model.js", () => ({
  addUpdate: jest.fn(),
  findByProductId: jest.fn(),
  findById: jest.fn(),
  updateContent: jest.fn(),
  deleteUpdate: jest.fn(),
}));

// Mock bidding history model functions
jest.unstable_mockModule("../models/biddingHistory.model.js", () => ({
  getUniqueBidders: jest.fn(),
}));

// Mock product comment model functions
jest.unstable_mockModule("../models/productComment.model.js", () => ({
  getUniqueCommenters: jest.fn(),
}));

// Import mocked modules
const productModel = await import("../models/product.model.js");
const reviewModel = await import("../models/review.model.js");
const productDescUpdateModel =
  await import("../models/productDescriptionUpdate.model.js");
const biddingHistoryModel = await import("../models/biddingHistory.model.js");
const productCommentModel = await import("../models/productComment.model.js");
const mailer = await import("../utils/mailer.js");

// Import the route under test
const sellerRouter = (await import("../routes/seller.route.js")).default;

// ================================================================
// MOCK DATA
// ================================================================

const mockDb = {
  users: {
    sellerUser: {
      id: 10,
      email: "seller@test.com",
      password: "hashed_password",
      fullname: "Test Seller",
      dob: "1990-01-01",
      role: "seller",
      is_verified: true,
      rating_point: 5,
    },
    regularUser: {
      id: 1,
      email: "user@test.com",
      password: "hashed_password",
      fullname: "Regular User",
      dob: "1992-05-15",
      role: "bidder",
      is_verified: true,
      rating_point: 3,
    },
  },
  stats: {
    sellerStats: {
      total_products: 15,
      active_auctions: 5,
      pending_products: 2,
      sold_products: 8,
    },
    pendingStats: {
      total_products: 2,
      total_value: 5000000,
    },
    soldStats: {
      total_products: 8,
      total_revenue: 25000000,
    },
  },
  products: {
    activeProduct: {
      id: 101,
      seller_id: 10,
      category_id: 1,
      name: "Vintage Camera",
      starting_price: 1000000,
      step_price: 100000,
      buy_now_price: 5000000,
      current_price: 1500000,
      highest_bidder_id: 1,
      created_at: "2024-01-01T00:00:00.000Z",
      end_at: "2024-01-10T00:00:00.000Z",
      status: "Active",
      thumbnail: "/images/products/p101_thumb.jpg",
      description: "A beautiful vintage camera in excellent condition",
      auto_extend: true,
      allow_unrated_bidder: false,
    },
    pendingProduct: {
      id: 102,
      seller_id: 10,
      name: "Laptop",
      current_price: 10000000,
      highest_bidder_id: 1,
      status: "Pending",
      end_at: "2023-12-25T00:00:00.000Z",
    },
    soldProduct: {
      id: 103,
      seller_id: 10,
      name: "Smartphone",
      current_price: 8000000,
      highest_bidder_id: 1,
      status: "Sold",
      end_at: "2023-12-20T00:00:00.000Z",
    },
    expiredProduct: {
      id: 104,
      seller_id: 10,
      name: "Tablet",
      current_price: 5000000,
      highest_bidder_id: null,
      status: "Expired",
      end_at: "2023-12-15T00:00:00.000Z",
    },
  },
  reviews: [
    {
      id: 1,
      reviewer_id: 10,
      reviewee_id: 1,
      product_id: 103,
      rating: 1,
      comment: "Excellent buyer!",
      created_at: "2024-01-01T00:00:00.000Z",
    },
  ],
  descriptionUpdates: [
    {
      id: 1,
      product_id: 101,
      content: "Added more details about the lens",
      created_at: "2024-01-02T00:00:00.000Z",
    },
  ],
  bidders: [
    { id: 1, email: "bidder1@test.com", fullname: "Bidder One" },
    { id: 2, email: "bidder2@test.com", fullname: "Bidder Two" },
  ],
  commenters: [
    { id: 3, email: "commenter@test.com", fullname: "Commenter User" },
  ],
};

// ================================================================
// TEST APP SETUP
// ================================================================

function createTestApp(sessionData = {}) {
  const app = express();

  // Setup Handlebars
  const hbs = create({
    extname: ".handlebars",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "../views/layouts"),
    partialsDir: path.join(__dirname, "../views/partials"),
  });
  app.engine("handlebars", hbs.engine);
  app.set("view engine", "handlebars");
  app.set("views", path.join(__dirname, "../views"));

  // Body parsers
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Session middleware
  app.use(
    expressSession({
      secret: "test-secret",
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false },
    }),
  );

  // Mock authentication middleware
  app.use((req, res, next) => {
    req.session.isAuthenticated = sessionData.isAuthenticated || false;
    req.session.authUser = sessionData.authUser || null;
    req.session.returnUrl = sessionData.returnUrl || null;
    req.session.success_message = sessionData.success_message || null;

    res.locals.isAuthenticated = req.session.isAuthenticated;
    res.locals.authUser = req.session.authUser;
    res.locals.isSeller = req.session.authUser?.role === "seller";
    res.locals.isAdmin = req.session.authUser?.role === "admin";

    next();
  });

  // Mock isAuthenticated middleware
  const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) {
      next();
    } else {
      req.session.returnUrl = req.originalUrl;
      res.redirect("/account/signin");
    }
  };

  // Mock isSeller middleware
  const isSeller = (req, res, next) => {
    if (req.session.authUser?.role === "seller") {
      next();
    } else {
      res.render("403");
    }
  };

  // Mount seller routes with middleware
  app.use("/seller", isAuthenticated, isSeller, sellerRouter);

  return app;
}

// ================================================================
// TESTS
// ================================================================

describe("Seller Routes - Snapshot Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    randomCallCount = 0;

    // Setup default mock return values
    productModel.getSellerStats.mockResolvedValue(mockDb.stats.sellerStats);
    productModel.findAllProductsBySellerId.mockResolvedValue([
      mockDb.products.activeProduct,
    ]);
    productModel.findActiveProductsBySellerId.mockResolvedValue([
      mockDb.products.activeProduct,
    ]);
    productModel.findPendingProductsBySellerId.mockResolvedValue([
      mockDb.products.pendingProduct,
    ]);
    productModel.getPendingProductsStats.mockResolvedValue(
      mockDb.stats.pendingStats,
    );
    productModel.findSoldProductsBySellerId.mockResolvedValue([
      mockDb.products.soldProduct,
    ]);
    productModel.getSoldProductsStats.mockResolvedValue(mockDb.stats.soldStats);
    productModel.findExpiredProductsBySellerId.mockResolvedValue([
      mockDb.products.expiredProduct,
    ]);
    productModel.addProduct.mockResolvedValue([{ id: 200 }]);
    productModel.updateProductThumbnail.mockResolvedValue(true);
    productModel.addProductImages.mockResolvedValue(true);
    productModel.cancelProduct.mockResolvedValue(mockDb.products.activeProduct);
    productModel.findByProductId2.mockResolvedValue(
      mockDb.products.activeProduct,
    );

    reviewModel.getProductReview.mockResolvedValue(mockDb.reviews[0]);
    reviewModel.findByReviewerAndProduct.mockResolvedValue(null);
    reviewModel.createReview.mockResolvedValue({ id: 10 });
    reviewModel.updateByReviewerAndProduct.mockResolvedValue(true);
    reviewModel.updateReview.mockResolvedValue(true);

    productDescUpdateModel.addUpdate.mockResolvedValue({ id: 5 });
    productDescUpdateModel.findByProductId.mockResolvedValue(
      mockDb.descriptionUpdates,
    );
    productDescUpdateModel.findById.mockResolvedValue(
      mockDb.descriptionUpdates[0],
    );
    productDescUpdateModel.updateContent.mockResolvedValue(true);
    productDescUpdateModel.deleteUpdate.mockResolvedValue(true);

    biddingHistoryModel.getUniqueBidders.mockResolvedValue(mockDb.bidders);
    productCommentModel.getUniqueCommenters.mockResolvedValue(
      mockDb.commenters,
    );
  });

  // ================================================================
  // DASHBOARD & PRODUCT MANAGEMENT
  // ================================================================

  describe("GET /seller", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app).get("/seller").expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("FORBIDDEN: should show 403 for non-seller", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app).get("/seller").expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("GET /seller/products", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app).get("/seller/products").expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /seller/products/active", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .get("/seller/products/active")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /seller/products/pending", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .get("/seller/products/pending")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /seller/products/sold", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .get("/seller/products/sold")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /seller/products/expired", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .get("/seller/products/expired")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  // ================================================================
  // ADD PRODUCT
  // ================================================================

  describe("GET /seller/products/add", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .get("/seller/products/add")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /seller/products/upload-thumbnail", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .post("/seller/products/upload-thumbnail")
        .attach("thumbnail", Buffer.from("fake-image"), "test.jpg")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("SUCCESS: should upload thumbnail and return file info", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/seller/products/upload-thumbnail")
        .attach("thumbnail", Buffer.from("fake-image"), "test.jpg")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  describe("POST /seller/products/upload-subimages", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .post("/seller/products/upload-subimages")
        .attach("images", Buffer.from("fake-image-1"), "test1.jpg")
        .attach("images", Buffer.from("fake-image-2"), "test2.jpg")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("SUCCESS: should upload subimages and return files info", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/seller/products/upload-subimages")
        .attach("images", Buffer.from("fake-image-1"), "test1.jpg")
        .attach("images", Buffer.from("fake-image-2"), "test2.jpg")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  // ================================================================
  // UPDATE PRODUCT
  // ================================================================

  describe("POST /seller/products/:id/cancel", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .post("/seller/products/101/cancel")
        .send({ reason: "Test cancellation", highest_bidder_id: 1 })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("SUCCESS: should cancel product with bidder rating", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/seller/products/101/cancel")
        .send({ reason: "Test cancellation", highest_bidder_id: 1 })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
      expect(productModel.cancelProduct).toHaveBeenCalledWith("101", 10);
      expect(reviewModel.createReview).toHaveBeenCalled();
    });

    test("SUCCESS: should cancel product without bidder", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/seller/products/101/cancel")
        .send({ reason: "No interest" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });

    test("ERROR: should return 404 for non-existent product", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      productModel.cancelProduct.mockRejectedValueOnce(
        new Error("Product not found"),
      );

      const response = await request(app)
        .post("/seller/products/999/cancel")
        .send({ reason: "Test" })
        .expect(404);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });

    test("ERROR: should return 403 for unauthorized cancellation", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      productModel.cancelProduct.mockRejectedValueOnce(
        new Error("Unauthorized"),
      );

      const response = await request(app)
        .post("/seller/products/101/cancel")
        .send({ reason: "Test" })
        .expect(403);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  describe("POST /seller/products/:id/rate", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .post("/seller/products/103/rate")
        .send({ rating: "positive", comment: "Great!", highest_bidder_id: 1 })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("SUCCESS: should create new positive rating", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/seller/products/103/rate")
        .send({
          rating: "positive",
          comment: "Excellent buyer!",
          highest_bidder_id: 1,
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
      expect(reviewModel.createReview).toHaveBeenCalledWith({
        reviewer_id: 10,
        reviewee_id: 1,
        product_id: "103",
        rating: 1,
        comment: "Excellent buyer!",
      });
    });

    test("SUCCESS: should create new negative rating", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/seller/products/103/rate")
        .send({
          rating: "negative",
          comment: "Payment delayed",
          highest_bidder_id: 1,
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
      expect(reviewModel.createReview).toHaveBeenCalledWith({
        reviewer_id: 10,
        reviewee_id: 1,
        product_id: "103",
        rating: -1,
        comment: "Payment delayed",
      });
    });

    test("SUCCESS: should update existing rating", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      reviewModel.findByReviewerAndProduct.mockResolvedValueOnce(
        mockDb.reviews[0],
      );

      const response = await request(app)
        .post("/seller/products/103/rate")
        .send({
          rating: "positive",
          comment: "Updated comment",
          highest_bidder_id: 1,
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
      expect(reviewModel.updateByReviewerAndProduct).toHaveBeenCalled();
    });

    test("ERROR: should return 400 when no bidder to rate", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/seller/products/103/rate")
        .send({ rating: "positive", comment: "Test" })
        .expect(400);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  describe("PUT /seller/products/:id/rate", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .put("/seller/products/103/rate")
        .send({ rating: "positive", comment: "Updated!", highest_bidder_id: 1 })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("SUCCESS: should update bidder rating", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .put("/seller/products/103/rate")
        .send({
          rating: "positive",
          comment: "Updated rating",
          highest_bidder_id: 1,
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
      expect(reviewModel.updateReview).toHaveBeenCalledWith(10, 1, "103", {
        rating: 1,
        comment: "Updated rating",
      });
    });

    test("ERROR: should return 400 when no bidder to rate", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .put("/seller/products/103/rate")
        .send({ rating: "positive" })
        .expect(400);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  // ================================================================
  // PRODUCT DESCRIPTION UPDATES
  // ================================================================

  describe("POST /seller/products/:id/append-description", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .post("/seller/products/101/append-description")
        .send({ description: "New information" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("SUCCESS: should append description and send notifications", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/seller/products/101/append-description")
        .send({ description: "Additional lens details" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
      expect(productDescUpdateModel.addUpdate).toHaveBeenCalledWith(
        "101",
        "Additional lens details",
      );
      expect(biddingHistoryModel.getUniqueBidders).toHaveBeenCalledWith("101");
      expect(productCommentModel.getUniqueCommenters).toHaveBeenCalledWith(
        "101",
      );
    });

    test("ERROR: should return 400 for empty description", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/seller/products/101/append-description")
        .send({ description: "   " })
        .expect(400);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });

    test("ERROR: should return 404 for non-existent product", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      productModel.findByProductId2.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/seller/products/999/append-description")
        .send({ description: "Test" })
        .expect(404);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });

    test("ERROR: should return 403 for unauthorized append", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      productModel.findByProductId2.mockResolvedValueOnce({
        ...mockDb.products.activeProduct,
        seller_id: 999,
      });

      const response = await request(app)
        .post("/seller/products/101/append-description")
        .send({ description: "Test" })
        .expect(403);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  describe("GET /seller/products/:id/description-updates", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .get("/seller/products/101/description-updates")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("SUCCESS: should return description updates", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .get("/seller/products/101/description-updates")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
      expect(productDescUpdateModel.findByProductId).toHaveBeenCalledWith(
        "101",
      );
    });

    test("ERROR: should return 404 for non-existent product", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      productModel.findByProductId2.mockResolvedValueOnce(null);

      const response = await request(app)
        .get("/seller/products/999/description-updates")
        .expect(404);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });

    test("ERROR: should return 403 for unauthorized access", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      productModel.findByProductId2.mockResolvedValueOnce({
        ...mockDb.products.activeProduct,
        seller_id: 999,
      });

      const response = await request(app)
        .get("/seller/products/101/description-updates")
        .expect(403);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  describe("PUT /seller/products/description-updates/:updateId", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .put("/seller/products/description-updates/1")
        .send({ content: "Updated content" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("SUCCESS: should update description content", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .put("/seller/products/description-updates/1")
        .send({ content: "Updated lens information" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
      expect(productDescUpdateModel.updateContent).toHaveBeenCalledWith(
        "1",
        "Updated lens information",
      );
    });

    test("ERROR: should return 400 for empty content", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .put("/seller/products/description-updates/1")
        .send({ content: "   " })
        .expect(400);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });

    test("ERROR: should return 404 for non-existent update", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      productDescUpdateModel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .put("/seller/products/description-updates/999")
        .send({ content: "Test" })
        .expect(404);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });

    test("ERROR: should return 403 for unauthorized update", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      productModel.findByProductId2.mockResolvedValueOnce({
        ...mockDb.products.activeProduct,
        seller_id: 999,
      });

      const response = await request(app)
        .put("/seller/products/description-updates/1")
        .send({ content: "Test" })
        .expect(403);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  describe("DELETE /seller/products/description-updates/:updateId", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const app = createTestApp({ isAuthenticated: false });

      const response = await request(app)
        .delete("/seller/products/description-updates/1")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("SUCCESS: should delete description update", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .delete("/seller/products/description-updates/1")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
      expect(productDescUpdateModel.deleteUpdate).toHaveBeenCalledWith("1");
    });

    test("ERROR: should return 404 for non-existent update", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      productDescUpdateModel.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .delete("/seller/products/description-updates/999")
        .expect(404);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });

    test("ERROR: should return 403 for unauthorized deletion", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      productModel.findByProductId2.mockResolvedValueOnce({
        ...mockDb.products.activeProduct,
        seller_id: 999,
      });

      const response = await request(app)
        .delete("/seller/products/description-updates/1")
        .expect(403);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });
});
