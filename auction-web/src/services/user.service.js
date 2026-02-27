import bcrypt from 'bcryptjs';
import * as userModel from '../models/user.model.js';

export const UserService = {
  /**
   * Update user profile including password changes and email uniqueness checks
   * @param {number} userId 
   * @param {Object} updateData { email, fullname, address, date_of_birth, old_password, new_password, confirm_new_password }
   * @returns {Object} { updatedUser, error, user }
   */
  async updateProfile(userId, updateData) {
    const { email, fullname, address, date_of_birth, old_password, new_password, confirm_new_password } = updateData;
    const currentUser = await userModel.findById(userId);

    // 1. KIỂM TRA MẬT KHẨU CŨ (Chỉ cho non-OAuth users)
    if (!currentUser.oauth_provider) {
      if (!old_password || !bcrypt.compareSync(old_password, currentUser.password_hash)) {
        return { error: 'Password is incorrect!', user: currentUser };
      }
    }

    // 2. KIỂM TRA TRÙNG EMAIL
    if (email !== currentUser.email) {
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return { error: 'Email is already in use by another user.', user: currentUser };
      }
    }

    // 3. KIỂM TRA MẬT KHẨU MỚI (Chỉ cho non-OAuth users)
    if (!currentUser.oauth_provider && new_password) {
      if (new_password !== confirm_new_password) {
        return { error: 'New passwords do not match.', user: currentUser };
      }
    }

    // 4. CHUẨN BỊ DỮ LIỆU UPDATE
    const entity = {
      email,
      fullname,
      address: address || currentUser.address,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : currentUser.date_of_birth,
    };
    
    // Chỉ cập nhật password cho non-OAuth users
    if (!currentUser.oauth_provider) {
      entity.password_hash = new_password
        ? bcrypt.hashSync(new_password, 10)
        : currentUser.password_hash;
    }

    // 5. GỌI MODEL UPDATE
    const updatedUser = await userModel.update(userId, entity);
    
    if (updatedUser) {
      delete updatedUser.password_hash;
    }

    return { updatedUser };
  }
};
