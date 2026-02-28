import db from '../utils/db.js';
import * as userModel from '../models/user.model.js';
import * as upgradeRequestModel from '../models/upgradeRequest.model.js';

export default {
    /**
     * Handles the bidder's request to become a seller.
     * Requires marking their user profile AND creating the request record.
     */
    submitUpgradeRequest: async (userId) => {
        return db.transaction(async (trx) => {
            // First, check if a request already exists to prevent duplicate entries
            // although the model's insert might handle, it's safer logic-wise
            // Note: The original route didn't check this, it just tried to insert.
            // We will stick to the original flow but wrapped in a transaction.
            
            await userModel.markUpgradePending(userId, trx);
            await upgradeRequestModel.createUpgradeRequest(userId, trx);
            
            return true;
        });
    },

    /**
     * Handles the admin approving a bidder's request.
     * Requires marking the request approved AND promoting the user role.
     */
    approveUpgradeRequest: async (requestId, bidderId) => {
        return db.transaction(async (trx) => {
            await upgradeRequestModel.approveUpgradeRequest(requestId, trx);
            await userModel.updateUserRoleToSeller(bidderId, trx);
            
            return true;
        });
    },

    /**
     * Handles the admin rejecting a bidder's request.
     * Only requires updating the request, but we route it via service for consistency.
     */
    rejectUpgradeRequest: async (requestId, adminNote) => {
        return db.transaction(async (trx) => {
            // Logic to reject the upgrade request
            await upgradeRequestModel.rejectUpgradeRequest(requestId, adminNote, trx);
            // Optional: Might need to un-flag user if that was a requirement, 
            // but original `user.route.js` didn't. We keep original logic.
            return true;
        });
    }
};
