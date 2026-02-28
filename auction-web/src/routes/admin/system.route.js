import express from 'express';
import * as systemSettingModel from '../../models/systemSetting.model.js';
const router = express.Router();

const DEFAULT_SETTINGS = {
    new_product_limit_minutes: 60,
    auto_extend_trigger_minutes: 5,
    auto_extend_duration_minutes: 10
};

router.get('/settings', async (req, res) => {
    try {
        const settingsArray = await systemSettingModel.getAllSettings();
        const settings = { ...DEFAULT_SETTINGS };
        
        // Convert array to object
        if (settingsArray && settingsArray.length > 0) {
            settingsArray.forEach(setting => {
                settings[setting.key] = parseInt(setting.value);
            });
        }
        
        res.render('vwAdmin/system/setting', {
            settings,
            success_message: req.query.success
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        res.render('vwAdmin/system/setting', {
            settings: { ...DEFAULT_SETTINGS },
            error_message: 'Failed to load system settings'
        });
    }
});

router.post('/settings', async (req, res) => {
    try {
        // Update settings dynamically based on req.body keys
        for (const key of Object.keys(req.body)) {
            if (Object.keys(DEFAULT_SETTINGS).includes(key) || key) {
                await systemSettingModel.updateSetting(key, req.body[key]);
            }
        }
        
        res.redirect('/admin/system/settings?success=Settings updated successfully');
    } catch (error) {
        console.error('Error updating settings:', error);
        const settingsArray = await systemSettingModel.getAllSettings();
        const settings = { ...DEFAULT_SETTINGS };
        
        if (settingsArray && settingsArray.length > 0) {
            settingsArray.forEach(setting => {
                settings[setting.key] = parseInt(setting.value);
            });
        }
        
        res.render('vwAdmin/system/setting', {
            settings,
            error_message: 'Failed to update settings. Please try again.'
        });
    }
});

export default router;
