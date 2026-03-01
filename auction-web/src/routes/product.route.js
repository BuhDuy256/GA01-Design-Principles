import express from 'express';
import { isAuthenticated } from '../middlewares/auth.mdw.js';
import { paginate } from '../utils/pagination.js';
import { ensureProductExists, ensureCanViewProduct } from '../utils/productAuthorization.js';
import * as orderService from '../services/order.service.js';
import * as productService from '../services/product.service.js';
import * as watchlistService from '../services/watchlist.service.js';
import * as commentService from '../services/comment.service.js';
import * as bidService from '../services/bid.service.js';
import { UserService } from '../services/user.service.js';
import { getUserRatingSummary } from '../services/rating.service.js';
import { sendRejectionNotification } from '../services/email.service.js';
const router = express.Router();

router.get('/category', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const sort = req.query.sort || '';
  const categoryId = req.query.catid;
  const limit = 3;
  const page = parseInt(req.query.page) || 1;

  // Call service layer
  const result = await productService.getProductsByCategory({
    categoryId,
    page,
    sort,
    userId,
    limit
  });

  const paginationData = paginate(page, result.total, limit);

  res.render('vwProduct/list', {
    products: result.products,
    ...paginationData,
    categoryId: categoryId,
    categoryName: result.category ? result.category.name : null,
    sort: sort,
  });
});

router.get('/search', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const q = req.query.q || '';
  const logic = req.query.logic || 'and'; // 'and' or 'or'
  const sort = req.query.sort || '';
  const limit = 3;
  const page = parseInt(req.query.page) || 1;

  // Call service layer
  const result = await productService.searchProducts({
    keywords: q,
    page,
    logic,
    sort,
    userId,
    limit
  });

  const paginationData = paginate(page, result.total, limit);

  res.render('vwProduct/list', {
    products: result.products,
    ...paginationData,
    q: q,
    logic: logic,
    sort: sort,
  });
});

router.get('/detail', async (req, res) => {
  try {
    const userId = req.session.authUser ? req.session.authUser.id : null;
    const productId = req.query.id;
    const commentPage = parseInt(req.query.commentPage) || 1;
    const commentsPerPage = 2;

    // Call service layer to get all product details
    const detailData = await productService.getProductDetail({
      productId,
      userId,
      commentPage,
      commentsPerPage
    });

    // Check product exists (service throws error if not found)
    const productError = ensureProductExists(detailData.product, { throwError: false });
    if (productError) {
      return res.status(productError.status).render('404', { message: productError.message });
    }

    // Authorization check: Non-ACTIVE products can only be viewed by seller or highest bidder
    const authError = ensureCanViewProduct(detailData.product, userId, detailData.productStatus);
    if (authError) {
      return res.status(authError.status).render('403', { message: authError.message });
    }

    // Filter rejected bidders (only for seller)
    let rejectedBidders = [];
    if (req.session.authUser && detailData.product.seller_id === req.session.authUser.id) {
      rejectedBidders = detailData.rejectedBidders;
    }

    // Get flash messages from session
    const success_message = req.session.success_message;
    const error_message = req.session.error_message;
    delete req.session.success_message;
    delete req.session.error_message;

    // Check if should show payment button (for seller or highest bidder when status is PENDING)
    let showPaymentButton = false;
    if (req.session.authUser && detailData.productStatus === 'PENDING') {
      const currentUserId = req.session.authUser.id;
      showPaymentButton = (detailData.product.seller_id === currentUserId || detailData.product.highest_bidder_id === currentUserId);
    }

    res.render('vwProduct/details', {
      product: detailData.product,
      productStatus: detailData.productStatus,
      authUser: req.session.authUser,
      descriptionUpdates: detailData.descriptionUpdates,
      biddingHistory: detailData.biddingHistory,
      rejectedBidders,
      comments: detailData.comments,
      success_message,
      error_message,
      related_products: detailData.related_products,
      seller_rating_point: detailData.sellerRatingSummary.rating_point,
      seller_has_reviews: detailData.sellerRatingSummary.reviews.length > 0,
      bidder_rating_point: detailData.bidderRatingSummary.rating_point,
      bidder_has_reviews: detailData.bidderRatingSummary.reviews.length > 0,
      commentPage,
      totalPages: detailData.totalPages,
      totalComments: detailData.totalComments,
      showPaymentButton
    });
  } catch (error) {
    console.error('Product detail error:', error);
    if (error.code === 'PRODUCT_NOT_FOUND') {
      return res.status(404).render('404', { message: 'Product not found' });
    }
    return res.status(500).render('500', { message: 'Server error' });
  }
});

// ROUTE: BIDDING HISTORY PAGE (Requires Authentication)
router.get('/bidding-history', isAuthenticated, async (req, res) => {
  const productId = req.query.id;

  if (!productId) {
    return res.redirect('/');
  }

  try {
    // Call service layer
    const data = await productService.getBiddingHistoryPage(productId);

    res.render('vwProduct/biddingHistory', {
      product: data.product,
      biddingHistory: data.biddingHistory
    });
  } catch (error) {
    console.error('Error loading bidding history:', error);
    if (error.code === 'PRODUCT_NOT_FOUND') {
      return res.status(404).render('404', { message: 'Product not found' });
    }
    res.status(500).render('500', { message: 'Unable to load bidding history' });
  }
});

// ROUTE 1: ADD TO WATCHLIST (POST)
router.post('/watchlist', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  await watchlistService.addToWatchlist(userId, productId);

  const retUrl = req.headers.referer || '/';
  res.redirect(retUrl);
});

// ROUTE 2: REMOVE FROM WATCHLIST (DELETE)
router.delete('/watchlist', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  await watchlistService.removeFromWatchlist(userId, productId);

  const retUrl = req.headers.referer || '/';
  res.redirect(retUrl);
});

// ROUTE 3: ĐẶT GIÁ (POST) - Refactored to use service layer
router.post('/bid', isAuthenticated, async (req, res) => {
  // Parse request data
  const userId = req.session.authUser.id;
  const productId = parseInt(req.body.productId);
  const bidAmount = parseFloat(req.body.bidAmount.replace(/,/g, ''));
  const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;

  try {
    // Call service layer - all business logic handled there
    const result = await bidService.placeBid({
      userId,
      productId,
      bidAmount,
      productUrl
    });

    // Format success message based on result
    let baseMessage = '';
    if (result.productSold) {
      if (result.newHighestBidderId === result.userId) {
        baseMessage = `Congratulations! You won the product with Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Please proceed to payment.`;
      } else {
        baseMessage = `Product has been sold to another bidder at Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND. Your bid helped reach the Buy Now threshold.`;
      }
    } else if (result.newHighestBidderId === result.userId) {
      baseMessage = `Bid placed successfully! Current price: ${result.newCurrentPrice.toLocaleString()} VND (Your max: ${result.bidAmount.toLocaleString()} VND)`;
    } else {
      baseMessage = `Bid placed! Another bidder is currently winning at ${result.newCurrentPrice.toLocaleString()} VND`;
    }

    if (result.autoExtended) {
      const extendedTimeStr = new Date(result.newEndTime).toLocaleString('vi-VN');
      baseMessage += ` | Auction extended to ${extendedTimeStr}`;
    }

    // Set session message and redirect
    req.session.success_message = baseMessage;
    res.redirect(`/products/detail?id=${productId}`);

  } catch (error) {
    console.error('Bid error:', error);
    req.session.error_message = error.message || 'An error occurred while placing bid. Please try again.';
    res.redirect(`/products/detail?id=${productId}`);
  }
});


// ROUTE: COMPLETE ORDER PAGE (For PENDING products)

router.get('/complete-order', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.authUser.id;
    const productId = req.query.id;

    if (!productId) return res.redirect('/');

    // Build complete order page data (includes product, payment info, etc.)
    const viewData = await orderService.buildCompleteOrderPageData(productId, userId);

    // Render View
    res.render('vwProduct/complete-order', viewData);

  } catch (error) {
    switch (error.code) {
      case 'PRODUCT_NOT_FOUND':
        return res.status(404).render('404', { message: 'Product not found' });
      case 'NOT_PENDING':
        return res.status(400).render('400', { message: 'Order is not in pending state' });
      case 'FORBIDDEN':
        return res.status(403).render('403', { message: 'You do not have permission to access this page' });
      default:
        console.error('Complete order page error:', error);
        return res.status(500).render('500', { message: 'Server Error' });
    }
  }
});



// ROUTE: POST COMMENT
router.post('/comment', isAuthenticated, async (req, res) => {
  const productId = String(req.body.productId);
  const { content, parentId } = req.body;
  const userId = req.session.authUser.id;
  const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;

  try {
    // Call service layer
    await commentService.postComment({
      productId,
      userId,
      content,
      parentId,
      productUrl
    });

    req.session.success_message = 'Comment posted successfully!';
    res.redirect(`/products/detail?id=${productId}`);

  } catch (error) {
    console.error('Post comment error:', error);
    req.session.error_message = error.message || 'Failed to post comment. Please try again.';
    res.redirect(`/products/detail?id=${productId}`);
  }
});


// ROUTE 4: GET BIDDING HISTORY (API endpoint - returns JSON)
router.get('/bid-history/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const data = await productService.getBiddingHistoryPage(productId);
    res.json({ success: true, data: data.biddingHistory });
  } catch (error) {
    console.error('Get bid history error:', error);
    res.status(500).json({ success: false, message: 'Unable to load bidding history' });
  }
});


// ROUTE: REJECT BIDDER (POST) - Seller rejects a bidder from a product
router.post('/reject-bidder', isAuthenticated, async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    // Call service layer - all business logic handled there
    const result = await bidService.rejectBidder({
      productId,
      bidderId,
      sellerId
    });

    // Send email notification to rejected bidder via email service
    if (result.rejectedBidderInfo && result.rejectedBidderInfo.email && result.productInfo) {
      const homeUrl = `${req.protocol}://${req.get('host')}/`;
      sendRejectionNotification({
        bidderId,
        productId,
        productName: result.productInfo.name,
        sellerName: result.sellerInfo ? result.sellerInfo.fullname : 'N/A',
        homeUrl
      });
    }

    res.json({ success: true, message: 'Bidder rejected successfully' });
  } catch (error) {
    console.error('Error rejecting bidder:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to reject bidder'
    });
  }
});

// ROUTE: UNREJECT BIDDER (POST) - Seller removes a bidder from rejected list
router.post('/unreject-bidder', isAuthenticated, async (req, res) => {
  const productId = String(req.body.productId);
  const bidderId = String(req.body.bidderId);
  const sellerId = req.session.authUser.id;

  try {
    // Call service layer
    await productService.unrejectBidder({ productId, bidderId, sellerId });

    res.json({ success: true, message: 'Bidder can now bid on this product again' });
  } catch (error) {
    console.error('Error unrejecting bidder:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to unreject bidder'
    });
  }
});

// ROUTE: BUY NOW (POST) - Bidder directly purchases product at buy now price
router.post('/buy-now', isAuthenticated, async (req, res) => {
  const { productId } = req.body;
  const userId = req.session.authUser.id;

  try {
    // Call service layer - all business logic handled there
    await bidService.buyNowPurchase({
      userId,
      productId
    });

    res.json({
      success: true,
      message: 'Congratulations! You have successfully purchased the product at Buy Now price. Please proceed to payment.',
      redirectUrl: `/products/complete-order?id=${productId}`
    });

  } catch (error) {
    console.error('Buy Now error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to purchase product'
    });
  }
});

// ROUTE: Seller Ratings Page
router.get('/seller/:sellerId/ratings', async (req, res) => {
  try {
    const sellerId = parseInt(req.params.sellerId);

    if (!sellerId) {
      return res.redirect('/');
    }

    // Get seller info via service
    const seller = await UserService.getUserById(sellerId);
    if (!seller) {
      return res.redirect('/');
    }

    // Get comprehensive rating summary via service
    const ratingSummary = await getUserRatingSummary(sellerId);

    res.render('vwProduct/seller-ratings', {
      sellerName: seller.fullname,
      rating_point: ratingSummary.rating_point,
      totalReviews: ratingSummary.totalReviews,
      positiveReviews: ratingSummary.positiveReviews,
      negativeReviews: ratingSummary.negativeReviews,
      reviews: ratingSummary.reviews
    });

  } catch (error) {
    console.error('Error loading seller ratings page:', error);
    res.redirect('/');
  }
});

// ROUTE: Bidder Ratings Page
router.get('/bidder/:bidderId/ratings', async (req, res) => {
  try {
    const bidderId = parseInt(req.params.bidderId);

    if (!bidderId) {
      return res.redirect('/');
    }

    // Get bidder info with masked name via service
    const bidder = await UserService.getUserWithMaskedName(bidderId);
    if (!bidder) {
      return res.redirect('/');
    }

    // Get comprehensive rating summary via service
    const ratingSummary = await getUserRatingSummary(bidderId);

    res.render('vwProduct/bidder-ratings', {
      bidderName: bidder.maskedName,
      rating_point: ratingSummary.rating_point,
      totalReviews: ratingSummary.totalReviews,
      positiveReviews: ratingSummary.positiveReviews,
      negativeReviews: ratingSummary.negativeReviews,
      reviews: ratingSummary.reviews
    });

  } catch (error) {
    console.error('Error loading bidder ratings page:', error);
    res.redirect('/');
  }
});

export default router