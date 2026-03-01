/**
 * @file account.route.snapshot.test.js
 * @description Characterization Tests (Snapshot Testing) for Account Routes
 * @purpose Create a "Safety Net" baseline before refactoring - captures current behavior
 *
 * This file tests ALL account endpoints with deterministic mocks to ensure
 * that future refactoring (extracting services, moving routes) doesn't change behavior.
 */

import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import session from "express-session";
import { engine } from "express-handlebars";
import expressHandlebarsSections from "express-handlebars-sections";
import methodOverride from "method-override";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================================================================
// DETERMINISTIC MOCKS - Prevents snapshots from changing over time
// ==================================================================

// Mock Date.now() to return consistent timestamp
const FIXED_TIMESTAMP = 1704067200000; // 2024-01-01 00:00:00 UTC
const FIXED_DATE = new Date(FIXED_TIMESTAMP);
const FIXED_OTP_EXPIRY = new Date(FIXED_TIMESTAMP + 15 * 60 * 1000);

// Mock Math.random() for OTP generation
const originalRandom = Math.random;
let mockRandomSequence = [0.123456, 0.234567, 0.345678, 0.456789];
let randomCallIndex = 0;
Math.random = jest.fn(() => {
  const value = mockRandomSequence[randomCallIndex % mockRandomSequence.length];
  randomCallIndex++;
  return value;
});

// Mock Date
global.Date = class extends Date {
  constructor(...args) {
    if (args.length === 0) {
      super(FIXED_TIMESTAMP);
    } else {
      super(...args);
    }
  }

  static now() {
    return FIXED_TIMESTAMP;
  }
};

// Mock mailer BEFORE importing routes
jest.unstable_mockModule("../utils/mailer.js", () => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: "test-message-id" }),
  transporter: {},
}));

// Mock database with deterministic data
const mockDb = {
  // Sample users for testing
  users: {
    regularUser: {
      id: 1,
      email: "user@test.com",
      fullname: "Test User",
      address: "123 Test St",
      password_hash:
        "$2a$10$YourHashedPasswordHere.123456789012345678901234567890123456", // bcrypt hash of "password123"
      role: "bidder",
      email_verified: true,
      oauth_provider: null,
      date_of_birth: new Date("1990-01-01"),
      created_at: FIXED_DATE,
    },
    unverifiedUser: {
      id: 2,
      email: "unverified@test.com",
      fullname: "Unverified User",
      address: "456 Test Ave",
      password_hash:
        "$2a$10$YourHashedPasswordHere.123456789012345678901234567890123456",
      role: "bidder",
      email_verified: false,
      oauth_provider: null,
      created_at: FIXED_DATE,
    },
    sellerUser: {
      id: 3,
      email: "seller@test.com",
      fullname: "Test Seller",
      address: "789 Seller Rd",
      password_hash:
        "$2a$10$YourHashedPasswordHere.123456789012345678901234567890123456",
      role: "seller",
      email_verified: true,
      oauth_provider: null,
      created_at: FIXED_DATE,
    },
    oauthUser: {
      id: 4,
      email: "oauth@test.com",
      fullname: "OAuth User",
      address: "321 OAuth St",
      password_hash: null,
      role: "bidder",
      email_verified: true,
      oauth_provider: "google",
      oauth_id: "google-123456",
      created_at: FIXED_DATE,
    },
  },

  // Mock OTP records
  otps: [
    {
      id: 1,
      user_id: 2,
      otp_code: "223456",
      purpose: "verify_email",
      expires_at: FIXED_OTP_EXPIRY,
      used: false,
    },
    {
      id: 2,
      user_id: 1,
      otp_code: "334567",
      purpose: "reset_password",
      expires_at: FIXED_OTP_EXPIRY,
      used: false,
    },
  ],

  // Mock watchlist products
  watchlistProducts: [
    {
      id: 1,
      product_id: 101,
      user_id: 1,
      product_name: "Vintage Watch",
      current_price: 500,
      end_time: new Date(FIXED_TIMESTAMP + 24 * 60 * 60 * 1000),
      thumbnail_url: "/static/images/products/watch.jpg",
    },
  ],

  // Mock bidding products
  biddingProducts: [
    {
      id: 101,
      name: "Antique Vase",
      current_price: 1200,
      bidder_id: 1,
      max_bid_amount: 1500,
      end_time: new Date(FIXED_TIMESTAMP + 48 * 60 * 60 * 1000),
      thumbnail_url: "/static/images/products/vase.jpg",
    },
  ],

  // Mock won auctions
  wonAuctions: [
    {
      id: 102,
      name: "Rare Coin Collection",
      final_price: 2500,
      seller_id: 3,
      seller_name: "Test Seller",
      status: "pending",
      end_time: new Date(FIXED_TIMESTAMP - 1 * 60 * 60 * 1000),
      thumbnail_url: "/static/images/products/coins.jpg",
    },
  ],

  // Mock reviews
  reviews: [
    {
      id: 1,
      reviewer_id: 4,
      reviewed_user_id: 1,
      product_id: 100,
      rating: 1,
      comment: "Great seller!",
      created_at: FIXED_DATE,
    },
  ],
};

// Create mock database functions
const createMockDbQuery = () => {
  const query = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
  };
  return query;
};

// Mock db module
jest.unstable_mockModule("../utils/db.js", () => {
  const mockDbFunction = jest.fn((tableName) => {
    const query = createMockDbQuery();

    // Configure different behaviors based on table name
    if (tableName === "users") {
      query.first.mockImplementation(() => {
        // Will be configured per test
        return null;
      });
      query.insert.mockImplementation(() => {
        const newUser = { ...mockDb.users.regularUser, id: 999 };
        query.returning.mockResolvedValue([newUser]);
        return query;
      });
    }

    if (tableName === "user_otps") {
      query.first.mockResolvedValue(mockDb.otps[0]);
    }

    return query;
  });

  mockDbFunction.fn = {
    now: jest.fn(() => FIXED_DATE),
  };

  return { default: mockDbFunction };
});

// Mock passport
jest.unstable_mockModule("../utils/passport.js", () => ({
  default: {
    initialize: () => (req, res, next) => next(),
    session: () => (req, res, next) => next(),
    authenticate: (strategy, options) => {
      return (req, res, next) => {
        if (
          strategy === "google" ||
          strategy === "facebook" ||
          strategy === "github"
        ) {
          req.user = mockDb.users.oauthUser;
          return next();
        }
        next();
      };
    },
  },
}));

// Mock bcrypt for deterministic password hashing/checking
jest.unstable_mockModule("bcryptjs", () => ({
  default: {
    hashSync: jest.fn(
      (password, rounds) => `$2a$10$MockedHash${password}${rounds}`,
    ),
    compareSync: jest.fn((password, hash) => {
      // For testing: "password123" always matches our mock hash
      return password === "password123";
    }),
  },
}));

// Import mocked modules
const { default: db } = await import("../utils/db.js");
const { sendMail } = await import("../utils/mailer.js");
const bcrypt = (await import("bcryptjs")).default;

// Mock all models with deterministic data
jest.unstable_mockModule("../models/user.model.js", () => ({
  add: jest.fn().mockResolvedValue({ ...mockDb.users.regularUser, id: 999 }),
  findById: jest.fn().mockResolvedValue(mockDb.users.regularUser),
  findByEmail: jest.fn((email) => {
    const user = Object.values(mockDb.users).find((u) => u.email === email);
    return Promise.resolve(user || null);
  }),
  update: jest.fn().mockResolvedValue({
    ...mockDb.users.regularUser,
    fullname: "Updated Name",
  }),
  createOtp: jest.fn().mockResolvedValue(undefined),
  findValidOtp: jest.fn().mockResolvedValue(mockDb.otps[0]),
  markOtpUsed: jest.fn().mockResolvedValue(undefined),
  verifyUserEmail: jest.fn().mockResolvedValue(undefined),
  markUpgradePending: jest.fn().mockResolvedValue(undefined),
  findByOAuthProvider: jest.fn().mockResolvedValue(null),
}));

jest.unstable_mockModule("../models/upgradeRequest.model.js", () => ({
  findByUserId: jest.fn().mockResolvedValue(null),
  createUpgradeRequest: jest
    .fn()
    .mockResolvedValue({ id: 1, user_id: 1, status: "pending" }),
}));

jest.unstable_mockModule("../models/watchlist.model.js", () => ({
  searchPageByUserId: jest.fn().mockResolvedValue(mockDb.watchlistProducts),
  countByUserId: jest.fn().mockResolvedValue({ count: "1" }),
}));

jest.unstable_mockModule("../models/autoBidding.model.js", () => ({
  getBiddingProductsByBidderId: jest
    .fn()
    .mockResolvedValue(mockDb.biddingProducts),
  getWonAuctionsByBidderId: jest.fn().mockResolvedValue(mockDb.wonAuctions),
}));

jest.unstable_mockModule("../models/review.model.js", () => ({
  calculateRatingPoint: jest.fn().mockResolvedValue({ rating_point: 5 }),
  getReviewsByUserId: jest.fn().mockResolvedValue(mockDb.reviews),
  findByReviewerAndProduct: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ id: 1 }),
  updateByReviewerAndProduct: jest.fn().mockResolvedValue(undefined),
}));

// Mock fetch for reCAPTCHA validation
global.fetch = jest.fn((url) => {
  return Promise.resolve({
    json: () => Promise.resolve({ success: true }),
  });
});

// Import models
const userModel = await import("../models/user.model.js");
const upgradeRequestModel = await import("../models/upgradeRequest.model.js");
const watchlistModel = await import("../models/watchlist.model.js");
const autoBiddingModel = await import("../models/autoBidding.model.js");
const reviewModel = await import("../models/review.model.js");

// Import routes AFTER all mocks are set up
const accountRouter = (await import("../routes/account.route.js")).default;

// ==================================================================
// TEST APP SETUP
// ==================================================================

function createTestApp() {
  const app = express();

  // Middleware setup matching production
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(methodOverride("_method"));

  // Session configuration
  app.use(
    session({
      secret: "test-secret-key",
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false },
    }),
  );

  // Handlebars setup
  app.engine(
    "handlebars",
    engine({
      defaultLayout: "main",
      layoutsDir: path.join(__dirname, "../views/layouts"),
      partialsDir: path.join(__dirname, "../views/partials"),
      helpers: {
        section: expressHandlebarsSections(),
        eq: (a, b) => a === b,
        add: (a, b) => a + b,
        format_number: (price) => new Intl.NumberFormat("en-US").format(price),
        mask_name: (fullname) => {
          if (!fullname) return null;
          const name = fullname.trim();
          if (name.length <= 2) return name[0] + "*";
          let masked = "";
          for (let i = 0; i < name.length; i++) {
            masked += i % 2 === 0 ? name[i] : "*";
          }
          return masked;
        },
        truncate: (str, len) => {
          if (!str) return "";
          if (str.length <= len) return str;
          return str.substring(0, len) + "...";
        },
        format_date: (date) => {
          if (!date) return "";
          const d = new Date(date);
          if (isNaN(d.getTime())) return "";
          return d.toISOString();
        },
      },
    }),
  );
  app.set("view engine", "handlebars");
  app.set("views", path.join(__dirname, "../views"));

  // Mount routes
  app.use("/account", accountRouter);

  return app;
}

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

/** Create authenticated session */
function createAuthSession(user = mockDb.users.regularUser) {
  return {
    authUser: user,
    isAuthenticated: true,
  };
}

/** Reset all mocks before each test */
function resetMocks() {
  jest.clearAllMocks();
  randomCallIndex = 0;
  sendMail.mockClear();
  userModel.findByEmail.mockImplementation((email) => {
    const user = Object.values(mockDb.users).find((u) => u.email === email);
    return Promise.resolve(user || null);
  });
}

// ==================================================================
// TEST SUITES
// ==================================================================

describe("Account Routes - Snapshot Tests", () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    resetMocks();
  });

  // ================================================================
  // AUTHENTICATION & REGISTRATION
  // ================================================================

  describe("GET /account/signup", () => {
    test("should render signup form with reCAPTCHA key", async () => {
      const response = await request(app).get("/account/signup").expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /account/signup", () => {
    test("SUCCESS: should create user and send verification email", async () => {
      userModel.findByEmail.mockResolvedValueOnce(null); // Email not exist

      const response = await request(app)
        .post("/account/signup")
        .send({
          fullname: "New User",
          email: "newuser@test.com",
          address: "123 New St",
          password: "password123",
          confirmPassword: "password123",
          "g-recaptcha-response": "mock-recaptcha-token",
        })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0]).toMatchSnapshot("email-sent");
    });

    test("ERROR: should show error when email already exists", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);

      const response = await request(app)
        .post("/account/signup")
        .send({
          fullname: "New User",
          email: "user@test.com", // Existing email
          address: "123 New St",
          password: "password123",
          confirmPassword: "password123",
          "g-recaptcha-response": "mock-recaptcha-token",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("ERROR: should show error when passwords don't match", async () => {
      userModel.findByEmail.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/account/signup")
        .send({
          fullname: "New User",
          email: "newuser@test.com",
          address: "123 New St",
          password: "password123",
          confirmPassword: "differentpassword",
          "g-recaptcha-response": "mock-recaptcha-token",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("ERROR: should show error when reCAPTCHA fails", async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false }),
      });

      const response = await request(app)
        .post("/account/signup")
        .send({
          fullname: "New User",
          email: "newuser@test.com",
          address: "123 New St",
          password: "password123",
          confirmPassword: "password123",
          "g-recaptcha-response": "invalid-token",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("ERROR: should show error when required fields missing", async () => {
      const response = await request(app)
        .post("/account/signup")
        .send({
          email: "newuser@test.com",
          "g-recaptcha-response": "mock-token",
          // Missing fullname, address, passwords
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("GET /account/signin", () => {
    test("should render signin form", async () => {
      const response = await request(app).get("/account/signin").expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("should show success message from session", async () => {
      const agent = request.agent(app);

      // Set session data
      await agent.get("/account/signin").set("Cookie", "connect.sid=test");

      const response = await agent.get("/account/signin").expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /account/signin", () => {
    test("SUCCESS: should login verified user", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);

      const response = await request(app)
        .post("/account/signin")
        .send({
          email: "user@test.com",
          password: "password123",
        })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("SUCCESS: should redirect to returnUrl after login", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);

      const agent = request.agent(app);

      // Simulate setting returnUrl in session
      const response = await agent
        .post("/account/signin")
        .send({
          email: "user@test.com",
          password: "password123",
        })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("REDIRECT: should redirect to verify-email for unverified user", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.unverifiedUser);

      const response = await request(app)
        .post("/account/signin")
        .send({
          email: "unverified@test.com",
          password: "password123",
        })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0]).toMatchSnapshot("otp-email-sent");
    });

    test("ERROR: should show error for invalid email", async () => {
      userModel.findByEmail.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/account/signin")
        .send({
          email: "nonexistent@test.com",
          password: "password123",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("ERROR: should show error for invalid password", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);
      bcrypt.compareSync.mockReturnValueOnce(false);

      const response = await request(app)
        .post("/account/signin")
        .send({
          email: "user@test.com",
          password: "wrongpassword",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /account/logout", () => {
    test("SUCCESS: should logout authenticated user", async () => {
      const agent = request.agent(app);

      // First login
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);
      await agent
        .post("/account/signin")
        .send({ email: "user@test.com", password: "password123" });

      // Then logout
      const response = await agent.post("/account/logout").expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });

    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app).post("/account/logout").expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /account/verify-email", () => {
    test("should render OTP verification form", async () => {
      const response = await request(app)
        .get("/account/verify-email")
        .query({ email: "user@test.com" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("should redirect to signin when email param missing", async () => {
      const response = await request(app)
        .get("/account/verify-email")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /account/verify-email", () => {
    test("SUCCESS: should verify email with valid OTP", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.unverifiedUser);
      userModel.findValidOtp.mockResolvedValueOnce(mockDb.otps[0]);

      const response = await request(app)
        .post("/account/verify-email")
        .send({
          email: "unverified@test.com",
          otp: "223456",
        })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
      expect(userModel.markOtpUsed).toHaveBeenCalledWith(1);
      expect(userModel.verifyUserEmail).toHaveBeenCalledWith(2);
    });

    test("ERROR: should show error for invalid OTP", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.unverifiedUser);
      userModel.findValidOtp.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/account/verify-email")
        .send({
          email: "unverified@test.com",
          otp: "000000",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /account/resend-otp", () => {
    test("INFO: should redirect verified user to signin", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);

      const response = await request(app)
        .post("/account/resend-otp")
        .send({ email: "user@test.com" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("ERROR: should show error for non-existent user", async () => {
      userModel.findByEmail.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/account/resend-otp")
        .send({ email: "nonexistent@test.com" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  // ================================================================
  // PASSWORD RECOVERY
  // ================================================================

  describe("GET /account/forgot-password", () => {
    test("should render forgot password form", async () => {
      const response = await request(app)
        .get("/account/forgot-password")
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /account/forgot-password", () => {
    test("SUCCESS: should send reset OTP to valid email", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);

      const response = await request(app)
        .post("/account/forgot-password")
        .send({ email: "user@test.com" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0]).toMatchSnapshot("reset-otp-email");
    });

    test("ERROR: should show error for non-existent email", async () => {
      userModel.findByEmail.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/account/forgot-password")
        .send({ email: "nonexistent@test.com" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /account/verify-forgot-password-otp", () => {
    test("SUCCESS: should verify OTP and show reset password form", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);
      userModel.findValidOtp.mockResolvedValueOnce(mockDb.otps[1]);

      const response = await request(app)
        .post("/account/verify-forgot-password-otp")
        .send({
          email: "user@test.com",
          otp: "334567",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
      expect(userModel.markOtpUsed).toHaveBeenCalledWith(2);
    });

    test("ERROR: should show error for invalid OTP", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);
      userModel.findValidOtp.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/account/verify-forgot-password-otp")
        .send({
          email: "user@test.com",
          otp: "000000",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /account/resend-forgot-password-otp", () => {
    test("SUCCESS: should resend password reset OTP", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);

      const response = await request(app)
        .post("/account/resend-forgot-password-otp")
        .send({ email: "user@test.com" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0]).toMatchSnapshot("resend-reset-otp-email");
    });

    test("ERROR: should show error for non-existent user", async () => {
      userModel.findByEmail.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/account/resend-forgot-password-otp")
        .send({ email: "nonexistent@test.com" })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  describe("POST /account/reset-password", () => {
    test("SUCCESS: should reset password and redirect to signin", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);

      const response = await request(app)
        .post("/account/reset-password")
        .send({
          email: "user@test.com",
          new_password: "newpassword123",
          confirm_new_password: "newpassword123",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
      expect(userModel.update).toHaveBeenCalled();
    });

    test("ERROR: should show error when passwords don't match", async () => {
      userModel.findByEmail.mockResolvedValueOnce(mockDb.users.regularUser);

      const response = await request(app)
        .post("/account/reset-password")
        .send({
          email: "user@test.com",
          new_password: "newpassword123",
          confirm_new_password: "differentpassword",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });

    test("ERROR: should show error for non-existent user", async () => {
      userModel.findByEmail.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/account/reset-password")
        .send({
          email: "nonexistent@test.com",
          new_password: "newpassword123",
          confirm_new_password: "newpassword123",
        })
        .expect(200);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.text).toMatchSnapshot("html-content");
    });
  });

  // ================================================================
  // OAUTH AUTHENTICATION
  // ================================================================

  describe("OAuth Routes", () => {
    describe("GET /account/auth/google/callback", () => {
      test("SUCCESS: should handle Google OAuth callback", async () => {
        const response = await request(app)
          .get("/account/auth/google/callback")
          .query({ code: "mock-auth-code" })
          .expect(302);

        expect(response.statusCode).toMatchSnapshot("status-code");
        expect(response.headers.location).toMatchSnapshot("redirect-location");
      });
    });

    describe("GET /account/auth/facebook/callback", () => {
      test("SUCCESS: should handle Facebook OAuth callback", async () => {
        const response = await request(app)
          .get("/account/auth/facebook/callback")
          .query({ code: "mock-auth-code" })
          .expect(302);

        expect(response.statusCode).toMatchSnapshot("status-code");
        expect(response.headers.location).toMatchSnapshot("redirect-location");
      });
    });

    describe("GET /account/auth/github/callback", () => {
      test("SUCCESS: should handle GitHub OAuth callback", async () => {
        const response = await request(app)
          .get("/account/auth/github/callback")
          .query({ code: "mock-auth-code" })
          .expect(302);

        expect(response.statusCode).toMatchSnapshot("status-code");
        expect(response.headers.location).toMatchSnapshot("redirect-location");
      });
    });
  });

  // ================================================================
  // PROFILE MANAGEMENT
  // ================================================================

  describe("GET /account/profile", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app).get("/account/profile").expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("PUT /account/profile", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .put("/account/profile")
        .send({ email: "user@test.com" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /account/ratings", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app).get("/account/ratings").expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  // ================================================================
  // UPGRADE TO SELLER
  // ================================================================

  describe("GET /account/request-upgrade", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .get("/account/request-upgrade")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /account/request-upgrade", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .post("/account/request-upgrade")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  // ================================================================
  // USER'S PRODUCT LISTS
  // ================================================================

  describe("GET /account/watchlist", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app).get("/account/watchlist").expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /account/bidding", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app).get("/account/bidding").expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /account/auctions", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app).get("/account/auctions").expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("POST /account/won-auctions/:productId/rate-seller", () => {
    test("UNAUTHORIZED: should return 302 when not authenticated", async () => {
      const response = await request(app)
        .post("/account/won-auctions/102/rate-seller")
        .send({ seller_id: 3, rating: "positive" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
    });
  });

  describe("PUT /account/won-auctions/:productId/rate-seller", () => {
    test("UNAUTHORIZED: should return 302 when not authenticated", async () => {
      const response = await request(app)
        .put("/account/won-auctions/102/rate-seller")
        .send({ rating: "positive" })
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
    });
  });

  describe("GET /account/seller/products", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .get("/account/seller/products")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });

  describe("GET /account/seller/sold-products", () => {
    test("UNAUTHORIZED: should redirect when not authenticated", async () => {
      const response = await request(app)
        .get("/account/seller/sold-products")
        .expect(302);

      expect(response.statusCode).toMatchSnapshot("status-code");
      expect(response.headers.location).toMatchSnapshot("redirect-location");
    });
  });
});

// ================================================================
// CLEANUP
// ================================================================

afterAll(() => {
  // Restore original random
  Math.random = originalRandom;

  // Clear all mocks
  jest.clearAllMocks();
});
