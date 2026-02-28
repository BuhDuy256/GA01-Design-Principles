import express from 'express';
import { isAuthenticated } from '../middlewares/auth.mdw.js';
import * as orderModel from '../models/order.model.js';
import * as invoiceModel from '../models/invoice.model.js';
import * as orderChatModel from '../models/orderChat.model.js';
import {upload} from '../utils/upload.js'
import {requireOrderAccess} from '../middlewares/orderAccess.mdw.js'
import * as orderService from '../services/order.service.js';
const router = express.Router();



router.post('/upload-images', isAuthenticated, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const urls = req.files.map(file => `uploads/${file.filename}`);
    res.json({ success: true, urls });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// ===================================================================================
// ORDER PAYMENT & SHIPPING ROUTES
// ===================================================================================

// Submit payment (Buyer)
router.post('/:orderId/submit-payment', isAuthenticated, requireOrderAccess('buyer'), async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const paymentData = req.body;
    
    await orderService.processPaymentSubmission(orderId, userId, paymentData);
    
    res.json({ success: true, message: 'Payment submitted successfully' });
  } catch (error) {
    console.error('Submit payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit payment' });
  }
});

// Confirm payment (Seller)
router.post('/:orderId/confirm-payment', isAuthenticated, requireOrderAccess('seller'), async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    // Verify payment invoice
    const paymentInvoice = await invoiceModel.getPaymentInvoice(orderId);
    if (!paymentInvoice) {
      return res.status(400).json({ error: 'No payment invoice found' });
    }
    
    await invoiceModel.verifyInvoice(paymentInvoice.id);
    await orderModel.updateStatus(orderId, 'payment_confirmed', userId);
    
    res.json({ success: true, message: 'Payment confirmed successfully' });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm payment' });
  }
});

// Submit shipping (Seller)
router.post('/:orderId/submit-shipping', isAuthenticated, requireOrderAccess('seller'), async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { tracking_number, shipping_provider, shipping_proof_urls, note } = req.body;
    
    
    // Create shipping invoice
    await invoiceModel.createShippingInvoice({
      order_id: orderId,
      issuer_id: userId,
      tracking_number,
      shipping_provider,
      shipping_proof_urls,
      note
    });
    
    await orderModel.updateStatus(orderId, 'shipped', userId);
    
    res.json({ success: true, message: 'Shipping info submitted successfully' });
  } catch (error) {
    console.error('Submit shipping error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit shipping' });
  }
});

// Confirm delivery (Buyer)
router.post('/:orderId/confirm-delivery', isAuthenticated, requireOrderAccess('buyer'), async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    
    await orderModel.updateStatus(orderId, 'delivered', userId);
    
    res.json({ success: true, message: 'Delivery confirmed successfully' });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm delivery' });
  }
});

// Route 1: Submit rating
router.post('/:orderId/submit-rating', isAuthenticated, requireOrderAccess(), async (req, res) => {
    try {
        const userId = req.session.authUser.id;
        const { rating, comment } = req.body;
        const order = req.order; 

        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        await orderService.submitRating(order, userId, rating, comment);
        
        res.json({ success: true, message: 'Rating submitted successfully' });
    } catch (error) {
        console.error('Submit rating error:', error);
        res.status(500).json({ error: error.message || 'Failed to submit rating' });
    }
});

// Route 2: Complete transaction (skip)
router.post('/:orderId/complete-transaction', isAuthenticated, requireOrderAccess(), async (req, res) => {
    try {
        const userId = req.session.authUser.id;
        const order = req.order;

        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        await orderService.skipRating(order, userId);
        
        res.json({ success: true, message: 'Transaction completed' });
    } catch (error) {
        console.error('Complete transaction error:', error);
        res.status(500).json({ error: error.message || 'Failed to complete transaction' });
    }
});

// Send message (Chat)
router.post('/:orderId/send-message', isAuthenticated, requireOrderAccess(), async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const { message } = req.body;
    
    
    await orderService.sendMessage(orderId, userId, message);
    
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Get chat messages for an order
router.get('/:orderId/messages', isAuthenticated, requireOrderAccess(), async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    
    // Take raw messages from DB
    const rawMessages = await orderChatModel.getMessagesByOrderId(orderId);
    
    // Transform raw messages to view data (format date, determine sent/received)
    const viewData = rawMessages.map(msg => ({
      message: msg.message,
      isSent: msg.sender_id === userId,
      formattedDate: new Date(msg.created_at).toLocaleString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        day: '2-digit', month: '2-digit', year: 'numeric'
      })
    }));

    // Render Handlebars partial to HTML string
    res.render('partials/chatMessages', { 
        messages: viewData,
        layout: false // Render without main layout since we only want the HTML snippet
    }, (err, htmlString) => {
        if (err) {
            console.error('Lỗi render Handlebars:', err);
            return res.status(500).json({ error: 'Lỗi tạo giao diện tin nhắn' });
        }
        
        res.json({ success: true, messagesHtml: htmlString });
    });
    
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message || 'Failed to get messages' });
  }
});

export default router;