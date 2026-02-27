import db from '../utils/db.js';

// ===================== OTP USING KNEX =====================

// Tạo OTP
export function createOtp({ user_id, otp_code, purpose, expires_at }) {
  return db('user_otps').insert({
    user_id,
    otp_code,
    purpose,
    expires_at
  });
}

// Tìm OTP còn hiệu lực
export function findValidOtp({ user_id, otp_code, purpose }) {
  return db('user_otps')
    .where({
      user_id,
      otp_code,
      purpose,
      used: false
    })
    .andWhere('expires_at', '>', db.fn.now())
    .orderBy('id', 'desc')
    .first();
}

// Đánh dấu OTP đã dùng
export function markOtpUsed(id) {
  return db('user_otps')
    .where('id', id)
    .update({ used: true });
}
