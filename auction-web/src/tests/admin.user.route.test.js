import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";

// Mock Session
let mockSession = () => (req, res, next) => {
  req.session = req.session || {};
  next();
};

// 1. Mock Models
const mockUserModel = {
  loadAllUsers: jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue({ id: 2 }),
  updateUserRoleToSeller: jest.fn(),
  add: jest.fn(),
  update: jest.fn(),
  deleteUser: jest.fn()
};
jest.unstable_mockModule("../models/user.model.js", () => mockUserModel);

const mockUpgradeModel = {
  loadAllUpgradeRequests: jest.fn(),
  approveUpgradeRequest: jest.fn(),
  rejectUpgradeRequest: jest.fn(),
};
jest.unstable_mockModule("../models/upgradeRequest.model.js", () => mockUpgradeModel);

const mockUpgradeService = {
  approveUpgradeRequest: jest.fn(),
  rejectUpgradeRequest: jest.fn(),
};
jest.unstable_mockModule("../services/upgrade.service.js", () => ({
  default: mockUpgradeService
}));

const mockMailer = {
  sendMail: jest.fn()
};
jest.unstable_mockModule("../utils/mailer.js", () => mockMailer);

const mockAdminUserService = {
  resetUserPassword: jest.fn().mockResolvedValue({ id: 1, fullname: "Test" })
};
jest.unstable_mockModule("../services/admin.user.service.js", () => mockAdminUserService);

// Load App
const adminUserRouter = (await import("../routes/admin/user.route.js")).default;
const adminUpgradeRouter = (await import("../routes/admin/upgrade.route.js")).default;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => mockSession()(req, res, next));

app.use((req, res, next) => {
  res.render = (view, options) => {
    res.status(200).json({ view, options });
  };
  next();
});

app.use("/admin/users/upgrade", adminUpgradeRouter);
app.use("/admin/users", adminUserRouter);

describe("Integration Tests: /admin/users/upgrade/*", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("IT-ADM-01: GET /upgrade-requests admin viewing list", async () => {
    const mockList = [{ id: 1, bidder_id: 2, status: 'pending' }];
    mockUpgradeModel.loadAllUpgradeRequests.mockResolvedValueOnce(mockList);

    const response = await request(app).get("/admin/users/upgrade/upgrade-requests");
    expect(response.status).toBe(200);
    expect(response.body.view).toBe("vwAdmin/users/upgradeRequests");
    expect(response.body.options.requests).toEqual(mockList);
  });

  test("IT-ADM-02: POST /upgrade/approve sets user role to SELLER", async () => {
    mockUpgradeModel.approveUpgradeRequest.mockResolvedValueOnce(1);
    mockUserModel.updateUserRoleToSeller.mockResolvedValueOnce(1);

    const response = await request(app).post("/admin/users/upgrade/upgrade/approve").send({
      id: 99,
      bidder_id: 2
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/users/upgrade-requests");
    expect(mockUpgradeService.approveUpgradeRequest).toHaveBeenCalledWith(99, 2);
  });

  test("IT-ADM-03: POST /upgrade/reject marks request as rejected", async () => {
    mockUpgradeModel.rejectUpgradeRequest.mockResolvedValueOnce(1);

    const response = await request(app).post("/admin/users/upgrade/upgrade/reject").send({
      id: 99,
      admin_note: "not qualified"
    });

    expect(response.headers.location).toBe("/admin/users/upgrade-requests");
    expect(mockUpgradeService.rejectUpgradeRequest).toHaveBeenCalledWith(99, "not qualified");
  });
});

describe("Integration Tests: /admin/users/* (Admin CRUD - Flow 8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("IT-ADM-USR-01: GET /list admin viewing user list", async () => {
    const mockUsers = [{ id: 1, fullname: "Test" }];
    mockUserModel.loadAllUsers.mockResolvedValueOnce(mockUsers);

    const response = await request(app).get("/admin/users/list");
    expect(response.status).toBe(200);
    expect(response.body.view).toBe("vwAdmin/users/list");
    expect(response.body.options.users).toEqual(mockUsers);
  });

  test("IT-ADM-USR-03: POST /edit updates a user", async () => {
    mockUserModel.update.mockResolvedValueOnce();

    const response = await request(app).post("/admin/users/edit").send({
      id: 1, fullname: "Updated", email: "test@example.com"
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/users/list");
    expect(mockUserModel.update).toHaveBeenCalled();
  });

  test("IT-ADM-USR-04: POST /reset-password resets password and sends email", async () => {
    mockAdminUserService.resetUserPassword.mockResolvedValueOnce({ id: 1, fullname: "Test" });

    const response = await request(app).post("/admin/users/reset-password").send({ id: 1 });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/users/list");
    expect(mockAdminUserService.resetUserPassword).toHaveBeenCalledWith(1);
  });

  test("IT-ADM-USR-05: POST /delete removes a user", async () => {
    mockUserModel.deleteUser.mockResolvedValueOnce();

    const response = await request(app).post("/admin/users/delete").send({ id: 1 });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/users/list");
    expect(mockUserModel.deleteUser).toHaveBeenCalledWith(1);
  });
});
