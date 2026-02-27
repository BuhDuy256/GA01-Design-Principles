import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";

// 1. Mock Dependencies
// Mock DB to prevent accidental real DB connections
jest.unstable_mockModule("../utils/db.js", () => ({
  default: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    orderBy: jest.fn().mockReturnThis(),
  })),
}));

// Mock User Model
const mockUserModel = {
  findByEmail: jest.fn(),
  add: jest.fn(),
  createOtp: jest.fn(),
  findValidOtp: jest.fn(),
  markOtpUsed: jest.fn(),
  verifyUserEmail: jest.fn(),
  update: jest.fn(),
};
jest.unstable_mockModule("../models/user.model.js", () => mockUserModel);

// Mock Mailer
const mockMailer = {
  sendMail: jest.fn(),
  sendVerificationOtp: jest.fn(),
  sendPasswordResetOtp: jest.fn()
};
jest.unstable_mockModule("../utils/mailer.js", () => mockMailer);

// Mock Passport
const mockPassport = {
  authenticate: jest.fn(() => (req, res, next) => next()),
  initialize: jest.fn(() => (req, res, next) => next()),
  session: jest.fn(() => (req, res, next) => next()),
};
jest.unstable_mockModule("../utils/passport.js", () => ({
  default: mockPassport,
}));

// Mock Global fetch for reCAPTCHA
global.fetch = jest.fn();

// Create Express App
const accountRouter = (await import("../routes/account.route.js")).default;
const authRouter = (await import("../routes/auth.route.js")).default;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: "test-secret",
    resave: false,
    saveUninitialized: true,
  }),
);

// Mock res.render to return JSON so we can assert on view variables
app.use((req, res, next) => {
  res.render = (view, options) => {
    res.status(200).json({ view, options });
  };
  next();
});

app.use("/account", accountRouter);
app.use("/account", authRouter);

describe("Integration Tests: account.route.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("IT-REG: Registration Flow", () => {
    test("IT-REG-01: POST /signup missing fields should render error", async () => {
      global.fetch.mockResolvedValueOnce({
        json: async () => ({ success: true }),
      });

      const response = await request(app).post("/account/signup").send({
        "g-recaptcha-response": "valid_token",
        fullname: "", // Missing
        email: "test@example.com",
        address: "123 St",
        password: "pass",
        confirmPassword: "pass",
      });

      expect(response.status).toBe(200);
      expect(response.body.view).toBe("vwAccount/auth/signup");
      expect(response.body.options.errors.fullname).toBeDefined();
    });

    test("IT-REG-02: POST /signup invalid reCAPTCHA should render error", async () => {
      global.fetch.mockResolvedValueOnce({
        json: async () => ({ success: false }),
      });

      const response = await request(app).post("/account/signup").send({
        "g-recaptcha-response": "invalid_token",
        fullname: "John",
        email: "test@example.com",
        address: "123 St",
        password: "pass",
        confirmPassword: "pass",
      });

      expect(response.status).toBe(200);
      expect(response.body.options.errors.captcha).toBeDefined();
    });

    test("IT-REG-03: POST /signup valid data should redirect to verify-email", async () => {
      global.fetch.mockResolvedValueOnce({
        json: async () => ({ success: true }),
      });
      mockUserModel.findByEmail.mockResolvedValueOnce(null); // Email not in use
      mockUserModel.add.mockResolvedValueOnce({
        id: 1,
        email: "test@example.com",
      }); // Mock inserts

      const response = await request(app).post("/account/signup").send({
        "g-recaptcha-response": "valid_token",
        fullname: "John Doe",
        email: "test@example.com",
        address: "123 Street",
        password: "password123",
        confirmPassword: "password123",
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        "/account/verify-email?email=test%40example.com",
      );
      expect(mockUserModel.add).toHaveBeenCalled();
      expect(mockUserModel.createOtp).toHaveBeenCalled();
      expect(mockMailer.sendVerificationOtp).toHaveBeenCalledTimes(1);
    });

    test("IT-REG-04: POST /verify-email valid OTP should redirect to signin", async () => {
      mockUserModel.findByEmail.mockResolvedValueOnce({
        id: 1,
        email: "test@example.com",
      });
      mockUserModel.findValidOtp.mockResolvedValueOnce({
        id: 99,
        otp_code: "123456",
      });

      const response = await request(app)
        .post("/account/verify-email")
        .send({ email: "test@example.com", otp: "123456" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/account/signin");
      expect(mockUserModel.markOtpUsed).toHaveBeenCalledWith(99);
      expect(mockUserModel.verifyUserEmail).toHaveBeenCalledWith(1);
    });
  });

  describe("IT-AUTH: Authentication Flow", () => {
    test("IT-AUTH-01: POST /signin non-existent email", async () => {
      mockUserModel.findByEmail.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/account/signin")
        .send({ email: "wrong@example.com", password: "pass" });

      expect(response.status).toBe(200);
      expect(response.body.view).toBe("vwAccount/auth/signin");
      expect(response.body.options.error_message).toBe(
        "Invalid email or password",
      );
    });

    test("IT-AUTH-02: POST /signin wrong password", async () => {
      const hashedPass = bcrypt.hashSync("correctpass", 10);
      mockUserModel.findByEmail.mockResolvedValueOnce({
        email: "test@example.com",
        password_hash: hashedPass,
      });

      const response = await request(app)
        .post("/account/signin")
        .send({ email: "test@example.com", password: "wrongpass" });

      expect(response.status).toBe(200);
      expect(response.body.options.error_message).toBe(
        "Invalid email or password",
      );
    });

    test("IT-AUTH-03: POST /signin correct creds but unverified email", async () => {
      const hashedPass = bcrypt.hashSync("correctpass", 10);
      mockUserModel.findByEmail.mockResolvedValueOnce({
        id: 1,
        email: "test@example.com",
        password_hash: hashedPass,
        email_verified: false,
      });

      const response = await request(app)
        .post("/account/signin")
        .send({ email: "test@example.com", password: "correctpass" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(
        "/account/verify-email?email=test%40example.com",
      );
    });

    test("IT-AUTH-04: POST /signin correct creds and verified email", async () => {
      const hashedPass = bcrypt.hashSync("correctpass", 10);
      mockUserModel.findByEmail.mockResolvedValueOnce({
        id: 1,
        email: "test@example.com",
        password_hash: hashedPass,
        email_verified: true,
      });

      const response = await request(app)
        .post("/account/signin")
        .send({ email: "test@example.com", password: "correctpass" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/");
    });
  });

  describe("IT-REC: Account Recovery Flow", () => {
    test("IT-REC-01: POST /forgot-password with valid email", async () => {
      mockUserModel.findByEmail.mockResolvedValueOnce({
        id: 1,
        email: "test@example.com",
        fullname: "John",
      });

      const response = await request(app)
        .post("/account/forgot-password")
        .send({ email: "test@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.view).toBe(
        "vwAccount/auth/verify-forgot-password-otp",
      );
      expect(mockUserModel.createOtp).toHaveBeenCalled();
      expect(mockMailer.sendPasswordResetOtp).toHaveBeenCalled();
    });

    test("IT-REC-03: POST /reset-password valid passwords", async () => {
      mockUserModel.findByEmail.mockResolvedValueOnce({
        id: 1,
        email: "test@example.com",
      });

      const response = await request(app).post("/account/reset-password").send({
        email: "test@example.com",
        new_password: "newpass",
        confirm_new_password: "newpass",
      });

      expect(response.status).toBe(200);
      expect(response.body.view).toBe("vwAccount/auth/signin");
      expect(mockUserModel.update).toHaveBeenCalled();

      // Verify bcrypt was used in the arg passed to update
      const updateArg = mockUserModel.update.mock.calls[0][1];
      expect(bcrypt.compareSync("newpass", updateArg.password_hash)).toBe(true);
    });
  });
});
