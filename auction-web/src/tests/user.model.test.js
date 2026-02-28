import { jest } from "@jest/globals";

// 1. Setup the Knex Mock BEFORE importing the model
const mockKnex = {
  insert: jest.fn().mockReturnThis(),
  returning: jest
    .fn()
    .mockResolvedValue([
      { id: 1, email: "test@example.com", fullname: "Test User" },
    ]),
  where: jest.fn().mockReturnThis(),
  first: jest.fn(),
  orderBy: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
};
const dbFn = jest.fn(() => mockKnex);
dbFn.fn = { now: jest.fn().mockReturnValue("NOW()") };

// Mock the db utility
jest.unstable_mockModule("../utils/db.js", () => {
  return { default: dbFn };
});

// Import the model dynamically AFTER the mock is set up for ES Modules
const userModel = await import("../models/user.model.js");

describe("Unit Tests: user.model.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("User CRUD operations", () => {
    test("UT-USR-01: add(user) should insert a new user and return the object", async () => {
      const newUser = {
        email: "test@example.com",
        fullname: "Test User",
        role: "bidder",
      };

      const result = await userModel.add(newUser);

      expect(dbFn).toHaveBeenCalledWith("users");
      expect(mockKnex.insert).toHaveBeenCalledWith(newUser);
      expect(mockKnex.returning).toHaveBeenCalledWith([
        "id",
        "email",
        "fullname",
        "address",
        "role",
        "email_verified",
      ]);
      expect(result).toEqual({
        id: 1,
        email: "test@example.com",
        fullname: "Test User",
      });
    });

    test("UT-USR-02: findByEmail(email) should return a user if email exists", async () => {
      const mockUser = { id: 1, email: "found@example.com" };
      mockKnex.first.mockResolvedValueOnce(mockUser);

      const result = await userModel.findByEmail("found@example.com");

      expect(dbFn).toHaveBeenCalledWith("users");
      expect(mockKnex.where).toHaveBeenCalledWith("email", "found@example.com");
      expect(mockKnex.first).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    test("UT-USR-02: findByEmail(email) should return undefined if email not found", async () => {
      mockKnex.first.mockResolvedValueOnce(undefined);

      const result = await userModel.findByEmail("notfound@example.com");

      expect(result).toBeUndefined();
    });

    test("UT-USR-10: markUpgradePending(id) should flag user as pending", async () => {
      mockKnex.update.mockResolvedValueOnce(1);
      await userModel.markUpgradePending(1);
      expect(dbFn).toHaveBeenCalledWith("users");
      expect(mockKnex.where).toHaveBeenCalledWith("id", 1);
      expect(mockKnex.update).toHaveBeenCalledWith({ is_upgrade_pending: true });
    });

    test("UT-USR-11: updateUserRoleToSeller(bidderId) should promote user to seller", async () => {
      mockKnex.update.mockResolvedValueOnce(1);
      await userModel.updateUserRoleToSeller(1);
      expect(dbFn).toHaveBeenCalledWith("users");
      expect(mockKnex.where).toHaveBeenCalledWith("id", 1);
      expect(mockKnex.update).toHaveBeenCalledWith({ role: "seller", is_upgrade_pending: false });
    });
  });

  describe("Admin User Management (Flow 8)", () => {
    test("UT-ADM-USR-01: loadAllUsers() should return an array of users ordered by id desc", async () => {
      mockKnex.orderBy.mockResolvedValueOnce([{ id: 1, email: "test@example.com" }]);
      const result = await userModel.loadAllUsers();
      expect(dbFn).toHaveBeenCalledWith("users");
      expect(mockKnex.orderBy).toHaveBeenCalledWith("id", "desc");
      expect(result).toEqual([{ id: 1, email: "test@example.com" }]);
    });

    test("UT-ADM-USR-02: findById(id) should return a user by their ID", async () => {
      mockKnex.first.mockResolvedValueOnce({ id: 10, email: "findme@example.com" });
      const result = await userModel.findById(10);
      expect(dbFn).toHaveBeenCalledWith("users");
      expect(mockKnex.where).toHaveBeenCalledWith("id", 10);
      expect(mockKnex.first).toHaveBeenCalled();
      expect(result).toEqual({ id: 10, email: "findme@example.com" });
    });

    test("UT-ADM-USR-04: update(id, data) should update an existing user", async () => {
      const updateData = { fullname: "Updated Name" };
      mockKnex.returning.mockResolvedValueOnce([{ id: 1, fullname: "Updated Name" }]);
      
      const result = await userModel.update(1, updateData);
      
      expect(dbFn).toHaveBeenCalledWith("users");
      expect(mockKnex.where).toHaveBeenCalledWith("id", 1);
      expect(mockKnex.update).toHaveBeenCalledWith(updateData);
      expect(result).toEqual({ id: 1, fullname: "Updated Name" });
    });

    test("UT-ADM-USR-05: deleteUser(id) should remove a user", async () => {
      mockKnex.del.mockResolvedValueOnce(1);
      
      const result = await userModel.deleteUser(99);
      
      expect(dbFn).toHaveBeenCalledWith("users");
      expect(mockKnex.where).toHaveBeenCalledWith("id", 99);
      expect(mockKnex.del).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

});
