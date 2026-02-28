import express from 'express';
import * as upgradeRequestModel from '../../models/upgradeRequest.model.js';
import upgradeService from '../../services/upgrade.service.js';

const router = express.Router();

router.get('/upgrade-requests', async (req, res) => {
    const requests = await upgradeRequestModel.loadAllUpgradeRequests();
    res.render('vwAdmin/users/upgradeRequests', { requests });
});

router.post('/upgrade/approve', async (req, res) => {
    const id = req.body.id;
    const bidderId = req.body.bidder_id;
    // Logic to approve the upgrade request securely via service
    await upgradeService.approveUpgradeRequest(id, bidderId);
    res.redirect('/admin/users/upgrade-requests');
});

router.post('/upgrade/reject', async (req, res) => {
    const id = req.body.id;
    const admin_note = req.body.admin_note;
    // Logic to reject the upgrade request securely via service
    await upgradeService.rejectUpgradeRequest(id, admin_note);
    res.redirect('/admin/users/upgrade-requests');
});

export default router;
