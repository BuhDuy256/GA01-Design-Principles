import { jest } from "@jest/globals";

const mockKnex = {
  insert: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  first: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
};

const dbFn = jest.fn(() => mockKnex);

jest.unstable_mockModule("../utils/db.js", () => {
  return { default: dbFn };
});

const upgradeRequestModel = await import("../models/upgradeRequest.model.js");

describe("Unit Tests: upgradeRequest.model.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("UT-UPG-01: createUpgradeRequest(bidderId) should insert a new request", async () => {
    mockKnex.insert.mockResolvedValueOnce([1]);
    await upgradeRequestModel.createUpgradeRequest(1);
    expect(dbFn).toHaveBeenCalledWith("upgrade_requests");
    expect(mockKnex.insert).toHaveBeenCalledWith({ bidder_id: 1 });
  });

  test("UT-UPG-02: findByUserId(bidderId) should return request by user id", async () => {
    mockKnex.first.mockResolvedValueOnce({ id: 1, bidder_id: 1 });
    const result = await upgradeRequestModel.findByUserId(1);
    expect(dbFn).toHaveBeenCalledWith("upgrade_requests");
    expect(mockKnex.where).toHaveBeenCalledWith("bidder_id", 1);
    expect(mockKnex.first).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, bidder_id: 1 });
  });

  test("UT-UPG-03: loadAllUpgradeRequests() should join users and return all", async () => {
    const mockData = [{ id: 1, fullname: "Test", email: "test@example.com" }];
    mockKnex.orderBy.mockResolvedValueOnce(mockData);
    const result = await upgradeRequestModel.loadAllUpgradeRequests();
    expect(dbFn).toHaveBeenCalledWith("upgrade_requests");
    expect(mockKnex.join).toHaveBeenCalledWith("users", "upgrade_requests.bidder_id", "users.id");
    expect(mockKnex.select).toHaveBeenCalledWith("upgrade_requests.*", "users.fullname as fullname", "users.email as email");
    expect(mockKnex.orderBy).toHaveBeenCalledWith("upgrade_requests.created_at", "desc");
    expect(result).toEqual(mockData);
  });

  test("UT-UPG-04: approveUpgradeRequest(id) should mark request as approved", async () => {
    mockKnex.update.mockResolvedValueOnce(1);
    await upgradeRequestModel.approveUpgradeRequest(1);
    expect(dbFn).toHaveBeenCalledWith("upgrade_requests");
    expect(mockKnex.where).toHaveBeenCalledWith("id", 1);
    expect(mockKnex.update).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
  });

  test("UT-UPG-05: rejectUpgradeRequest(id, note) should mark request as rejected with note", async () => {
    mockKnex.update.mockResolvedValueOnce(1);
    await upgradeRequestModel.rejectUpgradeRequest(1, "reason");
    expect(dbFn).toHaveBeenCalledWith("upgrade_requests");
    expect(mockKnex.where).toHaveBeenCalledWith("id", 1);
    expect(mockKnex.update).toHaveBeenCalledWith(expect.objectContaining({ status: "rejected", admin_note: "reason" }));
  });
});
