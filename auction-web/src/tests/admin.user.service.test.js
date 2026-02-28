import { jest } from "@jest/globals";

const mockUserModel = {
  findById: jest.fn(),
  update: jest.fn(),
};
jest.unstable_mockModule("../models/user.model.js", () => mockUserModel);

const mockMailer = {
  sendMail: jest.fn(),
};
jest.unstable_mockModule("../utils/mailer.js", () => mockMailer);

const mockBcrypt = {
  hash: jest.fn().mockResolvedValue("hashed_password"),
};
jest.unstable_mockModule("bcryptjs", () => ({ default: mockBcrypt }));

const adminUserService = await import("../services/admin.user.service.js");

describe("AdminUserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("resetUserPassword", () => {
    test("should reset password and send email successfully", async () => {
      const mockUser = {
        id: 1,
        fullname: "John Doe",
        email: "john@example.com",
      };
      
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.update.mockResolvedValue(true);
      mockMailer.sendMail.mockResolvedValue(true);

      const result = await adminUserService.resetUserPassword(1);

      expect(mockUserModel.findById).toHaveBeenCalledWith(1);
      expect(mockBcrypt.hash).toHaveBeenCalledWith("123", 10);
      expect(mockUserModel.update).toHaveBeenCalledWith(1, expect.objectContaining({
        password_hash: "hashed_password",
      }));
      expect(mockMailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "john@example.com",
          subject: "Your Password Has Been Reset - Online Auction",
        })
      );
      expect(result).toEqual(mockUser);
    });

    test("should throw error if user not found", async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(adminUserService.resetUserPassword(999)).rejects.toThrow("User not found");
      expect(mockUserModel.update).not.toHaveBeenCalled();
      expect(mockMailer.sendMail).not.toHaveBeenCalled();
    });

    test("should continue if email sending fails", async () => {
      const mockUser = {
        id: 2,
        fullname: "Jane Doe",
        email: "jane@example.com",
      };
      
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.update.mockResolvedValue(true);
      mockMailer.sendMail.mockRejectedValue(new Error("SMTP failure"));

      const result = await adminUserService.resetUserPassword(2);

      expect(mockUserModel.update).toHaveBeenCalled();
      expect(mockMailer.sendMail).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
    
    test("should not attempt to send email if user has no email", async () => {
        const mockUser = {
            id: 3,
            fullname: "No Email User",
            email: null,
        };
        
        mockUserModel.findById.mockResolvedValue(mockUser);
        mockUserModel.update.mockResolvedValue(true);
  
        const result = await adminUserService.resetUserPassword(3);
  
        expect(mockUserModel.update).toHaveBeenCalled();
        expect(mockMailer.sendMail).not.toHaveBeenCalled();
        expect(result).toEqual(mockUser);
      });
  });
});
