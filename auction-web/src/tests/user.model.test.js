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
  });


});
