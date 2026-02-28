import { jest } from "@jest/globals";

const mockKnex = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  first: jest.fn(),
  update: jest.fn(),
};

const dbFn = jest.fn(() => mockKnex);
jest.unstable_mockModule("../utils/db.js", () => ({ default: dbFn }));

const systemSettingModel = await import("../models/systemSetting.model.js");

describe("Unit Tests: systemSetting.model.js (Admin - Flow 8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("UT-ADM-SYS-01: getAllSettings() should return all system settings", async () => {
    mockKnex.select.mockResolvedValueOnce([{ key: "limit", value: "60" }]);

    const result = await systemSettingModel.getAllSettings();

    expect(dbFn).toHaveBeenCalledWith("system_settings");
    expect(mockKnex.select).toHaveBeenCalledWith("*");
    expect(result).toEqual([{ key: "limit", value: "60" }]);
  });

  test("UT-ADM-SYS-02: updateSetting(key, value) should update a specific setting", async () => {
    mockKnex.update.mockReturnValueOnce({
      where: jest.fn().mockResolvedValueOnce(1)
    });

    const result = await systemSettingModel.updateSetting("limit", 120);

    expect(dbFn).toHaveBeenCalledWith("system_settings");
    // Verify chained calls
    expect(result).toBe(1);
  });
});
