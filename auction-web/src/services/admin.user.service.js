import * as userModel from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { sendMail } from "../utils/mailer.js";
import { getPasswordResetHtml } from "../utils/emailTemplates.js";

/**
 * Resets a user's password to the default ('123') and sends an email notification.
 * Decouples the email sending logic from the route controller.
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
        html: getPasswordResetHtml(user.fullname, defaultPassword),
      });
      console.log(`Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // Continue even if email fails - password is still reset
    }
  }

  return user;
}
