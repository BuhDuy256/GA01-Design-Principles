import * as orderModel from '../models/order.model.js';
export function requireOrderAccess(role = 'any') {
    return async (req, res, next) => {
        const order = await orderModel.findById(req.params.orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        const userId = req.session.authUser.id;
        const allowed =
            role === 'buyer'  ? order.buyer_id === userId :
            role === 'seller' ? order.seller_id === userId :
            order.buyer_id === userId || order.seller_id === userId;
        if (!allowed) return res.status(403).json({ error: 'Unauthorized' });
        req.order = order; // attach for downstream use
        next();
    };
}