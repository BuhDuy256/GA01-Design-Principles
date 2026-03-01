import express from 'express';
import { isAuthenticated } from '../middlewares/auth.mdw.js';
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
    
    await orderService.confirmPayment(orderId, userId);
    
    res.json({ success: true, message: 'Payment confirmed successfully' });
  } catch (error) {
    if (error.code === 'NO_PAYMENT_INVOICE') {
      return res.status(400).json({ error: 'No payment invoice found' });
    }
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm payment' });
  }
});

// Submit shipping (Seller)
router.post('/:orderId/submit-shipping', isAuthenticated, requireOrderAccess('seller'), async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;
    const shippingData = req.body;
    
    await orderService.processShippingSubmission(orderId, userId, shippingData);
    
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
    
    await orderService.confirmDelivery(orderId, userId);
    
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
    
    // Get formatted messages from service (data transformation handled there)
    const messages = await orderService.getFormattedMessages(orderId, userId);
    
    // Render Handlebars partial to HTML string
    res.render('partials/chatMessages', { 
      messages,
      layout: false
    }, (err, htmlString) => {
      if (err) {
        console.error('Render error:', err);
        return res.status(500).json({ error: 'Failed to render messages' });
      }
      
      res.json({ success: true, messagesHtml: htmlString });
    });
    
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message || 'Failed to get messages' });
  }
});

export default router;