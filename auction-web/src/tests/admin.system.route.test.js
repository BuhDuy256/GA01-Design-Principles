import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";

let mockSession = () => (req, res, next) => {
  req.session = req.session || {};
  next();
};

const mockSystemSettingModel = {
  getAllSettings: jest.fn().mockResolvedValue([
    { key: "new_product_limit_minutes", value: "60" }
  ]),
  updateSetting: jest.fn().mockResolvedValue()
};
jest.unstable_mockModule("../models/systemSetting.model.js", () => mockSystemSettingModel);

const adminSystemRouter = (await import("../routes/admin/system.route.js")).default;
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

app.use("/admin/system", adminSystemRouter);

describe("Integration Tests: /admin/system/* (Flow 8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("IT-ADM-SYS-01: GET /settings admin viewing system settings", async () => {
    const response = await request(app).get("/admin/system/settings");
    expect(response.status).toBe(200);
    expect(response.body.view).toBe("vwAdmin/system/setting");
    expect(response.body.options.settings).toHaveProperty("new_product_limit_minutes", 60);
  });

  test("IT-ADM-SYS-02: POST /settings updates settings", async () => {
    const response = await request(app).post("/admin/system/settings").send({
      new_product_limit_minutes: 120,
      auto_extend_trigger_minutes: 5,
      auto_extend_duration_minutes: 10
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("/admin/system/settings?success=");
    expect(mockSystemSettingModel.updateSetting).toHaveBeenCalledWith("new_product_limit_minutes", 120);
  });
});
