import * as userModel from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import { sendMail } from '../utils/mailer.js';

/**
 * Resets a user's password to the default ('123') and sends an email notification.
 * Decouples the email sending logic from the route controller.
 */
export async function resetUserPassword(userId) {
    const defaultPassword = '123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    // Get user info to send email
    const user = await userModel.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    
    await userModel.update(userId, { 
        password_hash: hashedPassword,
        updated_at: new Date()
    });
    
    // Send email notification to user
    if (user.email) {
        try {
            await sendMail({
                to: user.email,
                subject: 'Your Password Has Been Reset - Online Auction',
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
                `
            });
            console.log(`Password reset email sent to ${user.email}`);
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            // Continue even if email fails - password is still reset
        }
    }
    
    return user;
}
