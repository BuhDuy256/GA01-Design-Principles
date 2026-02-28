import express from 'express';
import * as productModel from '../models/product.model.js';
import * as reviewModel from '../models/review.model.js';
import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import { upload } from '../utils/upload.js';
import * as notificationService from '../services/notification.service.js';
import * as productService from '../services/product.service.js';
import * as reviewService from '../services/review.service.js';
const router = express.Router();

router.get('/', async function (req, res) {
  const sellerId = req.session.authUser.id;
  const stats = await productModel.getSellerStats(sellerId);
  res.render('vwSeller/dashboard', { stats });
});

// All Products - View only
router.get('/products', async function (req, res) {
  const sellerId = req.session.authUser.id;
  const products = await productModel.findAllProductsBySellerId(sellerId);
  res.render('vwSeller/all-products', { products });
});

// Active Products - CRUD
router.get('/products/active', async function (req, res) {
  const sellerId = req.session.authUser.id;
  const products = await productModel.findActiveProductsBySellerId(sellerId);
  res.render('vwSeller/active', { products });
});

// Pending Products - Waiting for payment
router.get('/products/pending', async function (req, res) {
  const sellerId = req.session.authUser.id;
  const [products, stats] = await Promise.all([
    productModel.findPendingProductsBySellerId(sellerId),
    productModel.getPendingProductsStats(sellerId)
  ]);

  // Lấy message từ query param
  let success_message = '';
  if (req.query.message === 'cancelled') {
    success_message = 'Auction cancelled successfully!';
  }

  res.render('vwSeller/pending', { products, stats, success_message });
});

// Sold Products - Paid successfully
router.get('/products/sold', async function (req, res) {
    const sellerId = req.session.authUser.id;
    const [products, stats] = await Promise.all([
        productModel.findSoldProductsBySellerId(sellerId),
        productModel.getSoldProductsStats(sellerId)
    ]);
    
    const productsWithReview = await reviewService.enrichProductsWithReviews(products, sellerId);
    
    res.render('vwSeller/sold-products', { products: productsWithReview, stats });
});

// Expired Products - No bidder or cancelled
router.get('/products/expired', async function (req, res) {
    const sellerId = req.session.authUser.id;
    const products = await productModel.findExpiredProductsBySellerId(sellerId);
    
    const productsWithReview = await reviewService.enrichProductsWithReviews(products, sellerId);
    
    res.render('vwSeller/expired', { products: productsWithReview });
});

router.get('/products/add', async function (req, res) {
  const success_message = req.session.success_message;
  delete req.session.success_message; // Xóa message sau khi hiển thị
  res.render('vwSeller/add', { success_message });
});

router.post('/products/add', async function (req, res) {
    
    try {
        const product = req.body;
        const sellerId = req.session.authUser.id;
        // Main logic moved to service layer
        await productService.createProduct(product, sellerId);
        // Save success message to session and redirect
        req.session.success_message = 'Product added successfully!';
        res.redirect('/seller/products/add');

    }
    catch (error){
        console.error('Add product error:', error);
        // Save error message to session and redirect
        req.session.success_message = 'Failed to add product. Please try again.';
        res.redirect('/seller/products/add');
    }
});



router.post('/products/upload-thumbnail', upload.single('thumbnail'), async function (req, res) {
  res.json({
    success: true,
    file: req.file
  });
});

router.post('/products/upload-subimages', upload.array('images', 10), async function (req, res) {
  res.json({
    success: true,
    files: req.files
  });
});

// Cancel Product
router.post('/products/:id/cancel', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { reason, highest_bidder_id } = req.body;
        
        // Cancel product
        const product = await productModel.cancelProduct(productId, sellerId);
        
        // Create review if there's a bidder
        if (highest_bidder_id) {
            
            const reviewData = {
                reviewer_id: sellerId,
                reviewee_id: highest_bidder_id,
                product_id: productId,
                rating: -1,
                comment: reason || 'Auction cancelled by seller'
            };
            await reviewModel.createReview(reviewData);
        }
        
        res.json({ success: true, message: 'Auction cancelled successfully' });
    } catch (error) {
        console.error('Cancel product error:', error);
        
        if (error.message === 'Product not found') {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        if (error.message === 'Unauthorized') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Rate Bidder
router.post('/products/:id/rate', async (req, res) => {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { rating, comment, highest_bidder_id } = req.body;
        

        const actionResult = await reviewService.upsertProductRating(
            sellerId, 
            productId, 
            highest_bidder_id, 
            rating, 
            comment
        );
        
        // Return message based on whether it was a create or update action
        const message = actionResult === 'CREATED' 
            ? 'Rating submitted successfully' 
            : 'Rating updated successfully';
            
        res.json({ success: true, message });

    } catch (error) {
        if (error.message === 'NO_BIDDER') {
            return res.status(400).json({ success: false, message: 'No bidder to rate' });
        }
        
        console.error('Rate bidder error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update Bidder Rating
// router.put('/products/:id/rate', async function (req, res) {
//     try {
//         const productId = req.params.id;
//         const sellerId = req.session.authUser.id;
//         const { rating, comment, highest_bidder_id } = req.body;
        
//         if (!highest_bidder_id) {
//             return res.status(400).json({ success: false, message: 'No bidder to rate' });
//         }
        
//         // Map rating: positive -> 1, negative -> -1
//         const ratingValue = rating === 'positive' ? 1 : -1;
        
//         // Update review
//         await reviewModel.updateReview(sellerId, highest_bidder_id, productId, {
//             rating: ratingValue,
//             comment: comment || ''
//         });
        
//         res.json({ success: true, message: 'Rating updated successfully' });
//     } catch (error) {
//         console.error('Update rating error:', error);
//         res.status(500).json({ success: false, message: 'Server error' });
//     }
// });

// Append Description to Product
router.post('/products/:id/append-description', async function (req, res) {
    try {
        const productId = req.params.id;
        const sellerId = req.session.authUser.id;
        const { description } = req.body;
        
        if (!description || description.trim() === '') {
            return res.status(400).json({ success: false, message: 'Description is required' });
        }
        
        // Append description and get updated product details
        const product = await productService.appendDescription(productId, sellerId, description.trim());

        // Notify users about the description update
        const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;
        notificationService.notifyUsersAboutDescriptionUpdate(product, description.trim(), sellerId, productUrl);
        
        res.json({ success: true, message: 'Description appended successfully' });
    } catch (error) {
        if (error.message === 'PRODUCT_NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        if (error.message === 'UNAUTHORIZED') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        console.error('Append description error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get Description Updates for a Product
router.get('/products/:id/description-updates', async function (req, res) {
  try {
    const productId = req.params.id;
    const sellerId = req.session.authUser.id;

    // Verify that the product belongs to the seller
    const product = await productModel.findByProductId2(productId, null);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.seller_id !== sellerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Get all description updates for this product
    const updates = await productDescUpdateModel.findByProductId(productId);

    res.json({ success: true, updates });
  } catch (error) {
    console.error('Get description updates error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update a Description Update
router.put('/products/description-updates/:updateId', async function (req, res) {
  try {
    const updateId = req.params.updateId;
    const sellerId = req.session.authUser.id;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    // Get the update to verify ownership
    const update = await productDescUpdateModel.findById(updateId);
    if (!update) {
      return res.status(404).json({ success: false, message: 'Update not found' });
    }

    // Verify that the product belongs to the seller
    const product = await productModel.findByProductId2(update.product_id, null);
    if (!product || product.seller_id !== sellerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Update the content
    await productDescUpdateModel.updateContent(updateId, content.trim());

    res.json({ success: true, message: 'Update saved successfully' });
  } catch (error) {
    console.error('Update description error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a Description Update
router.delete('/products/description-updates/:updateId', async function (req, res) {
  try {
    const updateId = req.params.updateId;
    const sellerId = req.session.authUser.id;

    // Get the update to verify ownership
    const update = await productDescUpdateModel.findById(updateId);
    if (!update) {
      return res.status(404).json({ success: false, message: 'Update not found' });
    }

    // Verify that the product belongs to the seller
    const product = await productModel.findByProductId2(update.product_id, null);
    if (!product || product.seller_id !== sellerId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Delete the update
    await productDescUpdateModel.deleteUpdate(updateId);

    res.json({ success: true, message: 'Update deleted successfully' });
  } catch (error) {
    console.error('Delete description error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;