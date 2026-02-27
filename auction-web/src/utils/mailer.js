// utils/mailer.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load .env
dotenv.config();

// Create transporter for Gmail + App Password
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false, // 587 = STARTTLS (an toàn + dễ dùng)
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // APP PASSWORD 16 ký tự
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Test transporter (optional)
transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ SMTP ERROR:', error);
  } else {
    console.log('📧 SMTP Ready to send mail');
  }
});

// Export sendMail function
export async function sendMail({ to, subject, html }) {
  console.log('➡️ Sending mail to:', to);
  return transporter.sendMail({
    from: `"Online Auction" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
  });
}

/**
 * Send OTP for email verification
 */
export async function sendVerificationOtp(email, fullname, otp, isResend = false, verifyUrl = null) {
  let subject = 'Verify your Online Auction account';
  if (isResend) {
    subject = 'New OTP for email verification';
  }

  let htmlTemplate = `
    <p>Hi ${fullname || 'User'},</p>
    <p>${isResend ? '' : 'Thank you for registering at Online Auction.<br>'}Your OTP code is: <strong>${otp}</strong></p>
    <p>This code will expire in 15 minutes.</p>
  `;

  if (verifyUrl) {
    htmlTemplate += `
      <p>You can enter this code on the verification page, or click the link below:</p>
      <p><a href="${verifyUrl}">Verify your email</a></p>
      <p>If you did not register, please ignore this email.</p>
    `;
  }

  return sendMail({
    to: email,
    subject: subject,
    html: htmlTemplate
  });
}

/**
 * Send OTP for password reset
 */
export async function sendPasswordResetOtp(email, fullname, otp, isResend = false) {
  let subject = 'Password Reset for Your Online Auction Account';
  if (isResend) {
    subject = 'New OTP for Password Reset';
  }

  return sendMail({
    to: email,
    subject: subject,
    html: `
      <p>Hi ${fullname || 'User'},</p>
      <p>Your ${isResend ? 'new ' : ''}OTP code for password reset is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `,
  });
}

export { transporter };
