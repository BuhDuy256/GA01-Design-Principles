import * as userModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { sendMail } from "../utils/mailer.js";

/**
 * Admin User Service
 * Encapsulates business logic for admin user management operations.
 * Follows Single Responsibility Principle by separating business logic from HTTP handling.
 */

/**
 * Retrieves all users.
 * @returns {Promise<Array>} List of all users
 */
export async function getAllUsers() {
  return await userModel.loadAllUsers();
}

/**
 * Retrieves a specific user by ID.
 * @param {number} userId - The user ID
 * @returns {Promise<Object|null>} User details or null if not found
 */
export async function getUserById(userId) {
  return await userModel.findById(userId);
}

/**
 * Validates user data for creation/update.
 * @param {Object} userData - User data to validate
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Object} Validation result {isValid: boolean, errors: Array}
 */
function validateUserData(userData, isUpdate = false) {
  const errors = [];

  // Required fields for creation
  if (!isUpdate) {
    if (!userData.password || userData.password.trim().length < 3) {
      errors.push("Password must be at least 3 characters long");
    }
  }

  if (!userData.fullname || userData.fullname.trim() === "") {
    errors.push("Full name is required");
  }

  if (!userData.email || !userData.email.includes("@")) {
    errors.push("Valid email is required");
  }

  if (
    !userData.role ||
    !["admin", "seller", "bidder"].includes(userData.role)
  ) {
    errors.push("Valid role is required (admin, seller, or bidder)");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Transforms form data to user model format.
 * Handles type conversions and defaults.
 * @param {Object} formData - Raw form data
 * @returns {Object} Transformed user data
 */
function transformUserFormData(formData) {
  return {
    fullname: formData.fullname,
    email: formData.email,
    address: formData.address,
    date_of_birth: formData.date_of_birth || null,
    role: formData.role,
    email_verified:
      formData.email_verified === "true" || formData.email_verified === true,
    updated_at: new Date(),
  };
}

/**
 * Creates a new user with validation and password hashing.
 * @param {Object} userData - User creation data
 * @returns {Promise<Object>} Created user
 * @throws {Error} If validation fails or email already exists
 */
export async function createUser(userData) {
  // Validation
  const validation = validateUserData(userData, false);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  // Check if email already exists
  const existingUser = await userModel.findByEmail(userData.email);
  if (existingUser) {
    throw new Error("Email already exists");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  // Prepare user data
  const newUser = {
    ...transformUserFormData(userData),
    password_hash: hashedPassword,
    created_at: new Date(),
  };

  const createdUser = await userModel.add(newUser);
  return createdUser;
}

/**
 * Updates an existing user with validation.
 * @param {number} userId - The user ID to update
 * @param {Object} userData - User update data
 * @returns {Promise<Object>} Updated user
 * @throws {Error} If validation fails or user not found
 */
export async function updateUser(userId, userData) {
  // Check if user exists
  const existingUser = await userModel.findById(userId);
  if (!existingUser) {
    throw new Error("User not found");
  }

  // Validation
  const validation = validateUserData(userData, true);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(", "));
  }

  // Check if email is being changed to an existing email
  if (userData.email !== existingUser.email) {
    const emailExists = await userModel.findByEmail(userData.email);
    if (emailExists) {
      throw new Error("Email already exists");
    }
  }

  // Prepare update data
  const updateData = transformUserFormData(userData);

  await userModel.update(userId, updateData);
  return await userModel.findById(userId);
}

/**
 * Deletes a user with business rule validation.
 * @param {number} userId - The user ID to delete
 * @returns {Promise<void>}
 * @throws {Error} If user not found or cannot be deleted
 */
export async function deleteUser(userId) {
  // Check if user exists
  const user = await userModel.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Business rule: Don't allow deleting the last admin
  if (user.role === "admin") {
    const users = await userModel.loadAllUsers();
    const adminCount = users.filter((u) => u.role === "admin").length;
    if (adminCount <= 1) {
      throw new Error("Cannot delete the last admin user");
    }
  }

  await userModel.deleteUser(userId);
}

/**
 * Resets a user's password to the default ('123') and sends an email notification.
 * Decouples the email sending logic from the route controller.
 * @param {number} userId - The user ID
 * @returns {Promise<Object>} User object
 * @throws {Error} If user not found
 */
export async function resetUserPassword(userId) {
  const defaultPassword = "123";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // Get user info to send email
  const user = await userModel.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  await userModel.update(userId, {
    password_hash: hashedPassword,
    updated_at: new Date(),
  });

  // Send email notification to user
  if (user.email) {
    try {
      await sendMail({
        to: user.email,
        subject: "Your Password Has Been Reset - Online Auction",
        html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #333;">Password Reset Notification</h2>
                        <p>Dear <strong>${user.fullname}</strong>,</p>
                        <p>Your account password has been reset by an administrator.</p>
                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Your new temporary password:</strong></p>
                            <p style="font-size: 24px; color: #e74c3c; margin: 10px 0; font-weight: bold;">${defaultPassword}</p>
                        </div>
                        <p style="color: #e74c3c;"><strong>Important:</strong> Please log in and change your password immediately for security purposes.</p>
                        <p>If you did not request this password reset, please contact our support team immediately.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #888; font-size: 12px;">This is an automated message from Online Auction. Please do not reply to this email.</p>
                    </div>
                `,
      });
      console.log(`Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // Continue even if email fails - password is still reset
    }
  }

  return user;
}
