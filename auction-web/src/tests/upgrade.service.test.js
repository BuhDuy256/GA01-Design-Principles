import { jest } from "@jest/globals";

// Mock the models
const mockUserModel = {
  markUpgradePending: jest.fn(),
  updateUserRoleToSeller: jest.fn(),
};
jest.unstable_mockModule("../models/user.model.js", () => mockUserModel);

const mockUpgradeModel = {
  createUpgradeRequest: jest.fn(),
  approveUpgradeRequest: jest.fn(),
  rejectUpgradeRequest: jest.fn(),
};
jest.unstable_mockModule("../models/upgradeRequest.model.js", () => mockUpgradeModel);

// Mock the database transaction
const mockTrx = jest.fn();
const mockDb = {
  transaction: jest.fn((callback) => callback(mockTrx)),
};
jest.unstable_mockModule("../utils/db.js", () => ({
  default: mockDb,
}));

// Load the service to test
const db = (await import("../utils/db.js")).default;
const upgradeService = (await import("../services/upgrade.service.js")).default;

describe("Unit Tests for UpgradeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("submitUpgradeRequest", () => {
    it("should call markUpgradePending and createUpgradeRequest within a transaction", async () => {
      const userId = 1;
      await upgradeService.submitUpgradeRequest(userId);

      expect(db.transaction).toHaveBeenCalled();
      expect(mockUserModel.markUpgradePending).toHaveBeenCalledWith(userId, mockTrx);
      expect(mockUpgradeModel.createUpgradeRequest).toHaveBeenCalledWith(userId, mockTrx);
    });
  });

  describe("approveUpgradeRequest", () => {
    it("should call approveUpgradeRequest and updateUserRoleToSeller within a transaction", async () => {
      const requestId = 99;
      const bidderId = 5;
      await upgradeService.approveUpgradeRequest(requestId, bidderId);

      expect(db.transaction).toHaveBeenCalled();
      expect(mockUpgradeModel.approveUpgradeRequest).toHaveBeenCalledWith(requestId, mockTrx);
      expect(mockUserModel.updateUserRoleToSeller).toHaveBeenCalledWith(bidderId, mockTrx);
    });
  });

  describe("rejectUpgradeRequest", () => {
    it("should call rejectUpgradeRequest within a transaction", async () => {
      const requestId = 88;
      const adminNote = "Insufficient history";
      await upgradeService.rejectUpgradeRequest(requestId, adminNote);

      expect(db.transaction).toHaveBeenCalled();
      expect(mockUpgradeModel.rejectUpgradeRequest).toHaveBeenCalledWith(requestId, adminNote, mockTrx);
    });
  });
});
