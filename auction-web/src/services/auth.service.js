// services/auth.service.js
import { sendVerificationOtp, sendPasswordResetOtp } from '../utils/mailer.js';
import * as userModel from '../models/user.model.js';
import bcrypt from 'bcryptjs';

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const OTP_EXPIRES_IN_MINUTES = 15;

export const AuthService = {
  /**
   * Register a new user and send verification email
   * @param {Object} userData { email, fullname, address, password }
   * @param {string} verifyUrlBase Base URL for the verification link
   * @returns {Object} { user, error }
   */
  async registerUser(userData, verifyUrlBase) {
    const isEmailExist = await userModel.findByEmail(userData.email);
    if (isEmailExist) {
       return { error: { email: 'Email is already in use' } };
    }

    const hashedPassword = bcrypt.hashSync(userData.password, 10);
    const user = {
      email: userData.email,
      fullname: userData.fullname,
      address: userData.address,
      password_hash: hashedPassword,
      role: 'bidder',
    };

    const newUser = await userModel.add(user);

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

    await userModel.createOtp({
      user_id: newUser.id,
      otp_code: otp,
      purpose: 'verify_email',
      expires_at: expiresAt,
    });

    const verifyUrl = `${verifyUrlBase}?email=${encodeURIComponent(userData.email)}`;
    await sendVerificationOtp(userData.email, userData.fullname, otp, false, verifyUrl);

    return { user: newUser };
  },

  /**
   * Authenticate user credentials
   * @param {string} email
   * @param {string} password
   * @returns {Object} { user, error, unverified }
   */
  async loginWithCredentials(email, password) {
    const user = await userModel.findByEmail(email);
    if (!user) {
      return { error: 'Invalid email or password' };
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      return { error: 'Invalid email or password' };
    }

    if (!user.email_verified) {
      return { unverified: true, user };
    }

    return { user };
  },

  /**
   * Resend verification OTP
   * @param {string} email
   * @returns {Object} { error, alreadyVerified }
   */
  async resendVerificationOtp(email) {
    const user = await userModel.findByEmail(email);
    if (!user) {
      return { error: 'User not found.' };
    }

    if (user.email_verified) {
      return { alreadyVerified: true };
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

    await userModel.createOtp({
      user_id: user.id,
      otp_code: otp,
      purpose: 'verify_email',
      expires_at: expiresAt,
    });

    await sendVerificationOtp(email, user.fullname, otp, true);
    return {};
  },

  /**
   * Verify an OTP for email verification
   * @param {string} email
   * @param {string} otp
   * @returns {Object} { error }
   */
  async verifyEmailOtp(email, otp) {
    const user = await userModel.findByEmail(email);
    if (!user) return { error: 'User not found.' };

    const otpRecord = await userModel.findValidOtp({
      user_id: user.id,
      otp_code: otp,
      purpose: 'verify_email',
    });

    if (!otpRecord) return { error: 'Invalid or expired OTP.' };

    await userModel.markOtpUsed(otpRecord.id);
    await userModel.verifyUserEmail(user.id);
    return {};
  },

  /**
   * Process a password reset request
   * @param {string} email
   * @param {boolean} isResend
   * @returns {Object} { error }
   */
  async processPasswordResetRequest(email, isResend = false) {
    const user = await userModel.findByEmail(email);
    if (!user) return { error: 'Email not found.' };

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

    await userModel.createOtp({
      user_id: user.id,
      otp_code: otp,
      purpose: 'reset_password',
      expires_at: expiresAt,
    });

    await sendPasswordResetOtp(email, user.fullname, otp, isResend);
    return {};
  },

  /**
   * Verify a password reset OTP
   * @param {string} email
   * @param {string} otp
   * @returns {Object} { error }
   */
  async verifyPasswordResetOtp(email, otp) {
    const user = await userModel.findByEmail(email);
    if (!user) return { error: 'User not found.' };

    const otpRecord = await userModel.findValidOtp({
      user_id: user.id,
      otp_code: otp,
      purpose: 'reset_password',
    });

    if (!otpRecord) return { error: 'Invalid or expired OTP.' };

    await userModel.markOtpUsed(otpRecord.id);
    return {};
  },

  /**
   * Reset the user password
   * @param {string} email
   * @param {string} newPassword
   * @returns {Object} { error }
   */
  async resetPassword(email, newPassword) {
    const user = await userModel.findByEmail(email);
    if (!user) return { error: 'User not found.' };

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await userModel.update(user.id, { password_hash: hashedPassword });
    return {};
  }
};
