/**
 * Admin Routes - Comprehensive Snapshot Tests
 *
 * Purpose: Characterization testing to establish a baseline before refactoring
 * Approach: Capture full HTML/JSON responses with deterministic mocking
 * Scope: All 30+ admin endpoints across 5 route modules
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
global.Date = class extends Date {
  constructor(...args) {
    if (args.length === 0) {
      super(MOCK_DATE);
    } else {
      super(...args);
    }
  }
  static now() {
    return MOCK_DATE.getTime();
  }
};

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

// Mock bcryptjs for password hashing
jest.unstable_mockModule("bcryptjs", () => ({
  default: {
    hash: jest.fn().mockResolvedValue("$2a$10$mockedHashedPassword"),
    compare: jest.fn().mockResolvedValue(true),
  },
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

// Mock all category model functions
jest.unstable_mockModule("../models/category.model.js", () => ({
  findAll: jest.fn(),
  findByCategoryId: jest.fn(),
  findLevel1Categories: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  isCategoryHasProducts: jest.fn(),
}));

// Mock all user model functions
jest.unstable_mockModule("../models/user.model.js", () => ({
  loadAllUsers: jest.fn(),
  findById: jest.fn(),
  add: jest.fn(),
  update: jest.fn(),
  deleteUser: jest.fn(),
  updateUserRoleToSeller: jest.fn(),
  findUsersByRole: jest.fn(),
}));

// Mock upgrade request model functions
jest.unstable_mockModule("../models/upgradeRequest.model.js", () => ({
  loadAllUpgradeRequests: jest.fn(),
  approveUpgradeRequest: jest.fn(),
  rejectUpgradeRequest: jest.fn(),
}));

// Mock all product model functions
jest.unstable_mockModule("../models/product.model.js", () => ({
  findAll: jest.fn(),
  findByProductIdForAdmin: jest.fn(),
  addProduct: jest.fn(),
  updateProduct: jest.fn(),
  deleteProduct: jest.fn(),
  updateProductThumbnail: jest.fn(),
  addProductImages: jest.fn(),
}));

// Mock system setting model functions
jest.unstable_mockModule("../models/systemSetting.model.js", () => ({
  getAllSettings: jest.fn(),
  updateSetting: jest.fn(),
}));

// Import mocked modules
const categoryModel = await import("../models/category.model.js");
const userModel = await import("../models/user.model.js");
const upgradeRequestModel = await import("../models/upgradeRequest.model.js");
const productModel = await import("../models/product.model.js");
const systemSettingModel = await import("../models/systemSetting.model.js");
const mailer = await import("../utils/mailer.js");
const bcrypt = await import("bcryptjs");

// Import the routes under test
const adminAccountRouter = (await import("../routes/admin/account.route.js"))
  .default;
const adminCategoryRouter = (await import("../routes/admin/category.route.js"))
  .default;
const adminUserRouter = (await import("../routes/admin/user.route.js")).default;
const adminProductRouter = (await import("../routes/admin/product.route.js"))
  .default;
const adminSystemRouter = (await import("../routes/admin/system.route.js"))
  .default;

// ================================================================
// MOCK DATA
// ================================================================

const mockDb = {
  users: {
    adminUser: {
      id: 100,
      email: "admin@test.com",
      password_hash: "$2a$10$mockedHashedPassword",
      fullname: "Admin User",
      address: "Admin Address",
      date_of_birth: "1985-01-01",
      role: "admin",
      email_verified: true,
      rating_point: 0,
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
    },
    regularUser: {
      id: 1,
      email: "user@test.com",
      password_hash: "$2a$10$hashedPassword",
      fullname: "Regular User",
      address: "User Address",
      date_of_birth: "1992-05-15",
      role: "bidder",
      email_verified: true,
      rating_point: 3,
    },
    sellerUser: {
      id: 10,
      email: "seller@test.com",
      password_hash: "$2a$10$hashedPassword",
      fullname: "Seller User",
      address: "Seller Address",
      date_of_birth: "1990-01-01",
      role: "seller",
      email_verified: true,
      rating_point: 5,
    },
  },
  categories: {
    electronics: {
      id: 1,
      name: "Electronics",
      parent_id: null,
      level: 1,
    },
    laptops: {
      id: 2,
      name: "Laptops",
      parent_id: 1,
      level: 2,
    },
    fashion: {
      id: 3,
      name: "Fashion",
      parent_id: null,
      level: 1,
    },
  },
  products: {
    activeProduct: {
      id: 101,
      seller_id: 10,
      seller_name: "Seller User",
      category_id: 1,
      name: "Vintage Camera",
      starting_price: 1000000,
      step_price: 100000,
      buy_now_price: 5000000,
      current_price: 1500000,
      highest_bidder_id: 1,
      highest_bidder_name: "Regular User",
      created_at: "2024-01-01T00:00:00.000Z",
      end_at: "2024-01-10T00:00:00.000Z",
      status: "Active",
      thumbnail: "/images/products/p101_thumb.jpg",
      description: "A beautiful vintage camera",
      auto_extend: true,
      allow_unrated_bidder: false,
    },
  },
  upgradeRequests: [
    {
      id: 1,
      bidder_id: 1,
      bidder_name: "Regular User",
      bidder_email: "user@test.com",
      status: "pending",
      requested_at: "2024-01-01T00:00:00.000Z",
    },
  ],
  systemSettings: [
    { key: "new_product_limit_minutes", value: "60" },
    { key: "auto_extend_trigger_minutes", value: "5" },
    { key: "auto_extend_duration_minutes", value: "10" },
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

  // Mock session data
  app.use((req, res, next) => {
    req.session.isAuthenticated = sessionData.isAuthenticated || false;
    req.session.authUser = sessionData.authUser || null;
    req.session.returnUrl = sessionData.returnUrl || null;
    req.session.success_message = sessionData.success_message || null;
    req.session.error_message = sessionData.error_message || null;

    res.locals.isAuthenticated = req.session.isAuthenticated;
    res.locals.authUser = req.session.authUser;
    res.locals.isSeller = req.session.authUser?.role === "seller";
    res.locals.isAdmin = req.session.authUser?.role === "admin";

    next();
  });

  // Mock isAdmin middleware
  const isAdmin = (req, res, next) => {
    if (req.session.authUser?.role === "admin") {
      next();
    } else {
      res.render("403");
    }
  };

  // Add isAdminMode flag for all /admin routes
  app.use("/admin", isAdmin, (req, res, next) => {
    res.locals.isAdminMode = true;
    next();
  });

  // Mount admin routes
  app.use("/admin/account", adminAccountRouter);
  app.use("/admin/users", adminUserRouter);
  app.use("/admin/categories", adminCategoryRouter);
  app.use("/admin/products", adminProductRouter);
  app.use("/admin/system", adminSystemRouter);

  return app;
}

// ================================================================
// TESTS
// ================================================================

describe("Admin Routes - Snapshot Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    randomCallCount = 0;

    // Setup default mock return values
    categoryModel.findAll.mockResolvedValue([
      mockDb.categories.electronics,
      mockDb.categories.fashion,
    ]);
    categoryModel.findByCategoryId.mockResolvedValue(
      mockDb.categories.electronics,
    );
    categoryModel.findLevel1Categories.mockResolvedValue([
      mockDb.categories.electronics,
      mockDb.categories.fashion,
    ]);
    categoryModel.createCategory.mockResolvedValue({ id: 10 });
    categoryModel.updateCategory.mockResolvedValue(true);
    categoryModel.deleteCategory.mockResolvedValue(true);
    categoryModel.isCategoryHasProducts.mockResolvedValue(false);

    userModel.loadAllUsers.mockResolvedValue([
      mockDb.users.adminUser,
      mockDb.users.regularUser,
      mockDb.users.sellerUser,
    ]);
    userModel.findById.mockResolvedValue(mockDb.users.regularUser);
    userModel.add.mockResolvedValue({ id: 200 });
    userModel.update.mockResolvedValue(true);
    userModel.deleteUser.mockResolvedValue(true);
    userModel.updateUserRoleToSeller.mockResolvedValue(true);
    userModel.findUsersByRole.mockResolvedValue([mockDb.users.sellerUser]);

    upgradeRequestModel.loadAllUpgradeRequests.mockResolvedValue(
      mockDb.upgradeRequests,
    );
    upgradeRequestModel.approveUpgradeRequest.mockResolvedValue(true);
    upgradeRequestModel.rejectUpgradeRequest.mockResolvedValue(true);

    productModel.findAll.mockResolvedValue([mockDb.products.activeProduct]);
    productModel.findByProductIdForAdmin.mockResolvedValue(
      mockDb.products.activeProduct,
    );
    productModel.addProduct.mockResolvedValue([{ id: 300 }]);
    productModel.updateProduct.mockResolvedValue(true);
    productModel.deleteProduct.mockResolvedValue(true);
    productModel.updateProductThumbnail.mockResolvedValue(true);
    productModel.addProductImages.mockResolvedValue(true);

    systemSettingModel.getAllSettings.mockResolvedValue(mockDb.systemSettings);
    systemSettingModel.updateSetting.mockResolvedValue(true);
  });

  // ================================================================
  // ADMIN ACCOUNT
  // ================================================================

  describe("GET /admin/account/profile", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app)
        .get("/admin/account/profile")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  // ================================================================
  // CATEGORY MANAGEMENT
  // ================================================================

  describe("GET /admin/categories/list", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .get("/admin/categories/list")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /admin/categories/add", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app)
        .post("/admin/categories/add")
        .send({ name: "New Category", parent_id: "" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should create category and redirect", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/categories/add")
        .send({ name: "New Category", parent_id: "" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(categoryModel.createCategory).toHaveBeenCalledWith({
        name: "New Category",
        parent_id: null,
      });
    });

    test("SUCCESS: should create subcategory with parent", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/categories/add")
        .send({ name: "Smartphones", parent_id: "1" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(categoryModel.createCategory).toHaveBeenCalledWith({
        name: "Smartphones",
        parent_id: "1",
      });
    });
  });

  describe("POST /admin/categories/edit", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/admin/categories/edit")
        .send({ id: "1", name: "Updated Category", parent_id: "" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should update category and redirect", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/categories/edit")
        .send({ id: "1", name: "Updated Electronics", parent_id: "" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(categoryModel.updateCategory).toHaveBeenCalledWith("1", {
        name: "Updated Electronics",
        parent_id: null,
      });
    });
  });

  describe("POST /admin/categories/delete", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app)
        .post("/admin/categories/delete")
        .send({ id: "3" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should delete category when no products", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/categories/delete")
        .send({ id: "3" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(categoryModel.isCategoryHasProducts).toHaveBeenCalledWith("3");
      expect(categoryModel.deleteCategory).toHaveBeenCalledWith("3");
    });

    test("ERROR: should not delete category with products", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      categoryModel.isCategoryHasProducts.mockResolvedValueOnce(true);

      const response = await request(app)
        .post("/admin/categories/delete")
        .send({ id: "1" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(categoryModel.deleteCategory).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // USER MANAGEMENT
  // ================================================================

  describe("GET /admin/users/list", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app).get("/admin/users/list").expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /admin/users/add", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app)
        .post("/admin/users/add")
        .send({
          fullname: "New User",
          email: "newuser@test.com",
          address: "Test Address",
          date_of_birth: "1995-01-01",
          role: "bidder",
          email_verified: "true",
          password: "password123",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should create user and redirect", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/users/add")
        .send({
          fullname: "New User",
          email: "newuser@test.com",
          address: "Test Address",
          date_of_birth: "1995-01-01",
          role: "bidder",
          email_verified: "true",
          password: "password123",
        })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(bcrypt.default.hash).toHaveBeenCalledWith("password123", 10);
      expect(userModel.add).toHaveBeenCalled();
    });
  });

  describe("POST /admin/users/edit", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/admin/users/edit")
        .send({
          id: "1",
          fullname: "Updated User",
          email: "updated@test.com",
          address: "Updated Address",
          date_of_birth: "1992-05-15",
          role: "seller",
          email_verified: "true",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should update user and redirect", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/users/edit")
        .send({
          id: "1",
          fullname: "Updated User",
          email: "updated@test.com",
          address: "Updated Address",
          date_of_birth: "1992-05-15",
          role: "seller",
          email_verified: "true",
        })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(userModel.update).toHaveBeenCalled();
    });
  });

  describe("POST /admin/users/reset-password", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app)
        .post("/admin/users/reset-password")
        .send({ id: "1" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should reset password and send email", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/users/reset-password")
        .send({ id: "1" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(bcrypt.default.hash).toHaveBeenCalledWith("123", 10);
      expect(userModel.update).toHaveBeenCalled();
      expect(mailer.sendMail).toHaveBeenCalled();
    });
  });

  describe("POST /admin/users/delete", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/admin/users/delete")
        .send({ id: "1" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should delete user and redirect", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/users/delete")
        .send({ id: "1" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(userModel.deleteUser).toHaveBeenCalledWith("1");
    });
  });

  describe("GET /admin/users/upgrade-requests", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app)
        .get("/admin/users/upgrade-requests")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /admin/users/upgrade/approve", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/admin/users/upgrade/approve")
        .send({ id: "1", bidder_id: "1" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should approve upgrade request", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/users/upgrade/approve")
        .send({ id: "1", bidder_id: "1" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(upgradeRequestModel.approveUpgradeRequest).toHaveBeenCalledWith(
        "1",
      );
      expect(userModel.updateUserRoleToSeller).toHaveBeenCalledWith("1");
    });
  });

  describe("POST /admin/users/upgrade/reject", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app)
        .post("/admin/users/upgrade/reject")
        .send({ id: "1", admin_note: "Not enough information" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should reject upgrade request", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/users/upgrade/reject")
        .send({ id: "1", admin_note: "Not enough information" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(upgradeRequestModel.rejectUpgradeRequest).toHaveBeenCalledWith(
        "1",
        "Not enough information",
      );
    });
  });

  // ================================================================
  // PRODUCT MANAGEMENT
  // ================================================================

  describe("GET /admin/products/list", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .get("/admin/products/list")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /admin/products/upload-thumbnail", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app)
        .post("/admin/products/upload-thumbnail")
        .attach("thumbnail", Buffer.from("fake-image"), "test.jpg")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should upload thumbnail and return file info", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/products/upload-thumbnail")
        .attach("thumbnail", Buffer.from("fake-image"), "test.jpg")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  describe("POST /admin/products/upload-subimages", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/admin/products/upload-subimages")
        .attach("images", Buffer.from("fake-image-1"), "test1.jpg")
        .attach("images", Buffer.from("fake-image-2"), "test2.jpg")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should upload subimages and return files info", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/products/upload-subimages")
        .attach("images", Buffer.from("fake-image-1"), "test1.jpg")
        .attach("images", Buffer.from("fake-image-2"), "test2.jpg")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.body).toMatchSnapshot("json-response");
    });
  });

  describe("POST /admin/products/edit", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app)
        .post("/admin/products/edit")
        .send({
          id: "101",
          name: "Updated Product",
          starting_price: "2000000",
          current_price: "2500000",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should update product and redirect", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/products/edit")
        .send({
          id: "101",
          name: "Updated Product",
          starting_price: "2000000",
          current_price: "2500000",
        })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(productModel.updateProduct).toHaveBeenCalledWith("101", {
        id: "101",
        name: "Updated Product",
        starting_price: "2000000",
        current_price: "2500000",
      });
    });
  });

  describe("POST /admin/products/delete", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/admin/products/delete")
        .send({ id: "101" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should delete product and redirect", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/products/delete")
        .send({ id: "101" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(productModel.deleteProduct).toHaveBeenCalledWith("101");
    });
  });

  // ================================================================
  // SYSTEM SETTINGS
  // ================================================================

  describe("GET /admin/system/settings", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.regularUser,
      });

      const response = await request(app)
        .get("/admin/system/settings")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /admin/system/settings", () => {
    test("FORBIDDEN: should show 403 for non-admin", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.sellerUser,
      });

      const response = await request(app)
        .post("/admin/system/settings")
        .send({
          new_product_limit_minutes: "120",
          auto_extend_trigger_minutes: "10",
          auto_extend_duration_minutes: "15",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("SUCCESS: should update settings and redirect", async () => {
      const app = createTestApp({
        isAuthenticated: true,
        authUser: mockDb.users.adminUser,
      });

      const response = await request(app)
        .post("/admin/system/settings")
        .send({
          new_product_limit_minutes: "120",
          auto_extend_trigger_minutes: "10",
          auto_extend_duration_minutes: "15",
        })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(systemSettingModel.updateSetting).toHaveBeenCalledWith(
        "new_product_limit_minutes",
        "120",
      );
      expect(systemSettingModel.updateSetting).toHaveBeenCalledWith(
        "auto_extend_trigger_minutes",
        "10",
      );
      expect(systemSettingModel.updateSetting).toHaveBeenCalledWith(
        "auto_extend_duration_minutes",
        "15",
      );
    });
  });
});
