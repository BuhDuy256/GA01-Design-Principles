import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";

// 1. Mock Middlewares
const mockAuth = {
  isAuthenticated: jest.fn((req, res, next) => next()), // Default authenticated
  isSeller: jest.fn((req, res, next) => next()),
  isAdmin: jest.fn((req, res, next) => next()),
};
jest.unstable_mockModule("../middlewares/auth.mdw.js", () => mockAuth);

// 2. Mock Models
const mockUserModel = {
  markUpgradePending: jest.fn(),
  findById: jest.fn().mockResolvedValue({ id: 1 }),
};
jest.unstable_mockModule("../models/user.model.js", () => mockUserModel);

const mockUpgradeModel = {
  findByUserId: jest.fn(),
  createUpgradeRequest: jest.fn(),
};
jest.unstable_mockModule("../models/upgradeRequest.model.js", () => mockUpgradeModel);

const mockUpgradeService = {
  submitUpgradeRequest: jest.fn(),
};
jest.unstable_mockModule("../services/upgrade.service.js", () => ({
  default: mockUpgradeService
}));

// Mock extra module dependencies from account router
const mockUserService = {
  updateProfile: jest.fn()
};
jest.unstable_mockModule("../services/user.service.js", () => ({ UserService: mockUserService }));

const mockPassport = {
  authenticate: jest.fn(() => (req, res, next) => next()),
  initialize: jest.fn(() => (req, res, next) => next()),
  session: jest.fn(() => (req, res, next) => next()),
};
jest.unstable_mockModule("../utils/passport.js", () => ({ default: mockPassport }));

// Load App
const accountRouter = (await import("../routes/account.route.js")).default;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Add a middleware to simulate a populated session.authUser
app.use((req, res, next) => {
  req.session = req.session || {};
  req.session.authUser = { id: 1, role: 'bidder' };
  next();
});

app.use((req, res, next) => {
  res.render = (view, options) => {
    res.status(200).json({ view, options });
  };
  next();
});

app.use("/account", accountRouter);

describe("Integration Tests: /account/request-upgrade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.isAuthenticated.mockImplementation((req, res, next) => next());
  });

  test("IT-REQ-01: GET /request-upgrade with NO existing request", async () => {
    mockUpgradeModel.findByUserId.mockResolvedValueOnce(undefined);
    const response = await request(app).get("/account/request-upgrade");
    expect(response.status).toBe(200);
    expect(response.body.view).toBe("vwAccount/request-upgrade");
    expect(response.body.options.upgrade_request).toBeUndefined();
  });

  test("IT-REQ-02: GET /request-upgrade with existing request", async () => {
    mockUpgradeModel.findByUserId.mockResolvedValueOnce({ id: 99, status: 'pending' });
    const response = await request(app).get("/account/request-upgrade");
    expect(response.status).toBe(200);
    expect(response.body.view).toBe("vwAccount/request-upgrade");
    expect(response.body.options.upgrade_request).toEqual({ id: 99, status: 'pending' });
  });

  test("IT-REQ-03: POST /request-upgrade valid request should redirect", async () => {
    mockUpgradeService.submitUpgradeRequest.mockResolvedValueOnce(true);

    const response = await request(app).post("/account/request-upgrade").send();
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/account/profile?send-request-upgrade=true");
    expect(mockUpgradeService.submitUpgradeRequest).toHaveBeenCalledWith(1);
  });

  test("IT-REQ-04: POST /request-upgrade unauthenticated user", async () => {
    mockAuth.isAuthenticated.mockImplementationOnce((req, res, next) => {
      res.redirect("/account/signin");
    });
    const response = await request(app).post("/account/request-upgrade").send();
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/account/signin");
  });
});
