import express from 'express';
import bcrypt from 'bcryptjs';
import * as upgradeRequestModel from '../../models/upgradeRequest.model.js';
import * as userModel from '../../models/user.model.js';
import * as adminUserService from '../../services/admin.user.service.js';
import { sendMail } from '../../utils/mailer.js';
const router = express.Router();


router.get('/list', async (req, res) => {
    const users = await userModel.loadAllUsers();
    
    res.render('vwAdmin/users/list', { 
        users,
        empty: users.length === 0
    });
});

router.get('/detail/:id', async (req, res) => {
    const id = req.params.id;
    const user = await userModel.findById(id);
    res.render('vwAdmin/users/detail', { user });
});

router.get('/add', async (req, res) => {
    res.render('vwAdmin/users/add');
});
router.post('/add', async (req, res) => {
    try {
        const { fullname, email, address, date_of_birth, role, email_verified, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            fullname,
            email,
            address,
            date_of_birth: date_of_birth || null,
            role,
            email_verified: email_verified === 'true',
            password_hash: hashedPassword,
            created_at: new Date(),
            updated_at: new Date()
        };
        
        await userModel.add(newUser);
        req.session.success_message = 'User added successfully!';
        res.redirect('/admin/users/list');
    } catch (error) {
        console.error('Add user error:', error);
        req.session.error_message = 'Failed to add user. Please try again.';
        res.redirect('/admin/users/add');
    }
});
router.get('/edit/:id', async (req, res) => {
    const id = req.params.id;
    const user = await userModel.findById(id);
    
    res.render('vwAdmin/users/edit', { user });
});

router.post('/edit', async (req, res) => {
    try {
        const { id, fullname, email, address, date_of_birth, role, email_verified } = req.body;
        
        const updateData = {
            fullname,
            email,
            address,
            date_of_birth: date_of_birth || null,
            role,
            email_verified: email_verified === 'true',
            updated_at: new Date()
        };
        
        await userModel.update(id, updateData);
        req.session.success_message = 'User updated successfully!';
        res.redirect('/admin/users/list');
    } catch (error) {
        console.error('Update user error:', error);
        req.session.error_message = 'Failed to update user. Please try again.';
        res.redirect(`/admin/users/edit/${req.body.id}`);
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { id } = req.body;
        const user = await adminUserService.resetUserPassword(id);
        
        req.session.success_message = `Password of ${user.fullname} reset successfully to default: 123`;
        res.redirect(`/admin/users/list`);
    } catch (error) {
        console.error('Reset password error:', error);
        req.session.error_message = 'Failed to reset password. Please try again.';
        res.redirect(`/admin/users/list`);
    }
});

router.post('/delete', async (req, res) => {
    try {
        const { id } = req.body;
        await userModel.deleteUser(id);
        req.session.success_message = 'User deleted successfully!';
        res.redirect('/admin/users/list');
    } catch (error) {
        console.error('Delete user error:', error);
        req.session.error_message = 'Failed to delete user. Please try again.';
        res.redirect('/admin/users/list');
    }
});
export default router;