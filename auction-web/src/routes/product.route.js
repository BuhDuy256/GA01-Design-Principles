import express from 'express';
import * as productModel from '../models/product.model.js';
import * as reviewModel from '../models/review.model.js';
import * as userModel from '../models/user.model.js';
import * as watchListModel from '../models/watchlist.model.js';
import * as biddingHistoryModel from '../models/biddingHistory.model.js';
import * as productCommentModel from '../models/productComment.model.js';
import * as categoryModel from '../models/category.model.js';
import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import * as systemSettingModel from '../models/systemSetting.model.js';
import * as rejectedBidderModel from '../models/rejectedBidder.model.js';
import * as invoiceModel from '../models/invoice.model.js';
import * as orderChatModel from '../models/orderChat.model.js';
import { isAuthenticated } from '../middlewares/auth.mdw.js';
import { resolveAuctionStatus } from '../services/auction/auction-state.js';
import * as auctionService from '../services/auction/auction.service.js';
import { buildBidResponseMessage } from '../services/auction/bid-engine.js';
import { sendMail } from '../utils/mailer.js';
import * as notificationService from '../services/notification.service.js';
import db from '../utils/db.js';
import { parsePostgresArray } from '../utils/dbHelpers.js';
import * as orderService from '../services/order.service.js';
const router = express.Router();

const prepareProductList = async (products) => {
  const now = new Date();
  if (!products) return [];

  // Load settings from database every time to get latest value
  const settings = await systemSettingModel.getSettings();
  const N_MINUTES = settings.new_product_limit_minutes;

  return products.map(product => {
    const created = new Date(product.created_at);
    const isNew = (now - created) < (N_MINUTES * 60 * 1000);

    return {
      ...product,
      is_new: isNew
    };
  });
};

router.get('/category', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const sort = req.query.sort || '';
  const categoryId = req.query.catid;
  const page = parseInt(req.query.page) || 1;
  const limit = 3;
  const offset = (page - 1) * limit;

  // Check if category is level 1 (parent_id is null)
  const category = await categoryModel.findByCategoryId(categoryId);

  let categoryIds = [categoryId];

  // If it's a level 1 category, include all child categories
  if (category && category.parent_id === null) {
    const childCategories = await categoryModel.findChildCategoryIds(categoryId);
    const childIds = childCategories.map(cat => cat.id);
    categoryIds = [categoryId, ...childIds];
  }

  const list = await productModel.findByCategoryIds(categoryIds, limit, offset, sort, userId);
  const products = await prepareProductList(list);
  const total = await productModel.countByCategoryIds(categoryIds);
  console.log('Total products in category:', total.count);
  const totalCount = parseInt(total.count) || 0;
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }
  res.render('vwProduct/list', {
    products: products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
    categoryId: categoryId,
    categoryName: category ? category.name : null,
    sort: sort,
  });
});

router.get('/search', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const q = req.query.q || '';
  const logic = req.query.logic || 'and'; // 'and' or 'or'
  const sort = req.query.sort || '';

  // If keyword is empty, return empty results
  if (q.length === 0) {
    return res.render('vwProduct/list', {
      q: q,
      logic: logic,
      sort: sort,
      products: [],
      totalCount: 0,
      from: 0,
      to: 0,
      currentPage: 1,
      totalPages: 0,
    });
  }

  const limit = 3;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;

  // Pass keywords directly without modification
  // plainto_tsquery will handle tokenization automatically
  const keywords = q.trim();

  // Search in both product name and category
  const list = await productModel.searchPageByKeywords(keywords, limit, offset, userId, logic, sort);
  const products = await prepareProductList(list);
  const total = await productModel.countByKeywords(keywords, logic);
  const totalCount = parseInt(total.count) || 0;

  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }

  res.render('vwProduct/list', {
    products: products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
    q: q,
    logic: logic,
    sort: sort,
  });
});

router.get('/detail', async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const productId = req.query.id;
  const product = await productModel.findByProductId2(productId, userId);
  const related_products = await productModel.findRelatedProducts(productId);

  // Kiểm tra nếu không tìm thấy sản phẩm
  if (!product) {
    return res.status(404).render('404', { message: 'Product not found' });
  }
  console.log('Product details:', product);
  // Determine product status (single source of truth via auction-state.js)
  const productStatus = resolveAuctionStatus(product);

  // Authorization check: Non-ACTIVE products can only be viewed by seller or highest bidder
  if (productStatus !== 'ACTIVE') {
    if (!userId) {
      // User not logged in, cannot view non-active products
      return res.status(403).render('403', { message: 'You do not have permission to view this product' });
    }

    const isSeller = product.seller_id === userId;
    const isHighestBidder = product.highest_bidder_id === userId;

    if (!isSeller && !isHighestBidder) {
      return res.status(403).render('403', { message: 'You do not have permission to view this product' });
    }
  }

  // Pagination for comments
  const commentPage = parseInt(req.query.commentPage) || 1;
  const commentsPerPage = 2; // 2 comments per page
  const offset = (commentPage - 1) * commentsPerPage;

  // Load description updates, bidding history, and comments in parallel
  const [descriptionUpdates, biddingHistory, comments, totalComments] = await Promise.all([
    productDescUpdateModel.findByProductId(productId),
    biddingHistoryModel.getBiddingHistory(productId),
    productCommentModel.getCommentsByProductId(productId, commentsPerPage, offset),
    productCommentModel.countCommentsByProductId(productId)
  ]);

  // Load rejected bidders (only for seller)
  let rejectedBidders = [];
  if (req.session.authUser && product.seller_id === req.session.authUser.id) {
    rejectedBidders = await rejectedBidderModel.getRejectedBidders(productId);
  }

  // Load replies for all comments in one batch to avoid N+1 query problem
  if (comments.length > 0) {
    const commentIds = comments.map(c => c.id);
    const allReplies = await productCommentModel.getRepliesByCommentIds(commentIds);

    // Group replies by parent comment id
    const repliesMap = new Map();
    for (const reply of allReplies) {
      if (!repliesMap.has(reply.parent_id)) {
        repliesMap.set(reply.parent_id, []);
      }
      repliesMap.get(reply.parent_id).push(reply);
    }

    // Attach replies to their parent comments
    for (const comment of comments) {
      comment.replies = repliesMap.get(comment.id) || [];
    }
  }

  // Calculate total pages
  const totalPages = Math.ceil(totalComments / commentsPerPage);

  // Get flash messages from session
  const success_message = req.session.success_message;
  const error_message = req.session.error_message;
  delete req.session.success_message;
  delete req.session.error_message;

  // Get seller rating
  const sellerRatingObject = await reviewModel.calculateRatingPoint(product.seller_id);
  const sellerReviews = await reviewModel.getReviewsByUserId(product.seller_id);

  // Get bidder rating (if exists)
  let bidderRatingObject = { rating_point: null };
  let bidderReviews = [];
  if (product.highest_bidder_id) {
    bidderRatingObject = await reviewModel.calculateRatingPoint(product.highest_bidder_id);
    bidderReviews = await reviewModel.getReviewsByUserId(product.highest_bidder_id);
  }

  // Check if should show payment button (for seller or highest bidder when status is PENDING)
  let showPaymentButton = false;
  if (req.session.authUser && productStatus === 'PENDING') {
    const userId = req.session.authUser.id;
    showPaymentButton = (product.seller_id === userId || product.highest_bidder_id === userId);
  }

  res.render('vwProduct/details', {
    product,
    productStatus, // Pass status to view
    authUser: req.session.authUser, // Pass authUser for checking highest_bidder_id
    descriptionUpdates,
    biddingHistory,
    rejectedBidders,
    comments,
    success_message,
    error_message,
    related_products,
    seller_rating_point: sellerRatingObject.rating_point,
    seller_has_reviews: sellerReviews.length > 0,
    bidder_rating_point: bidderRatingObject.rating_point,
    bidder_has_reviews: bidderReviews.length > 0,
    commentPage,
    totalPages,
    totalComments,
    showPaymentButton
  });
});

// ROUTE: BIDDING HISTORY PAGE (Requires Authentication)
router.get('/bidding-history', isAuthenticated, async (req, res) => {
  const productId = req.query.id;

  if (!productId) {
    return res.redirect('/');
  }

  try {
    // Get product information
    const product = await productModel.findByProductId2(productId, null);

    if (!product) {
      return res.status(404).render('404', { message: 'Product not found' });
    }

    // Load bidding history
    const biddingHistory = await biddingHistoryModel.getBiddingHistory(productId);

    res.render('vwProduct/biddingHistory', {
      product,
      biddingHistory
    });
  } catch (error) {
    console.error('Error loading bidding history:', error);
    res.status(500).render('500', { message: 'Unable to load bidding history' });
  }
});

// ROUTE 1: THÊM VÀO WATCHLIST (POST)
router.post('/watchlist', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  const isInWatchlist = await watchListModel.isInWatchlist(userId, productId);
  if (!isInWatchlist) {
    await watchListModel.addToWatchlist(userId, productId);
  }

  // SỬA LẠI: Lấy địa chỉ trang trước đó từ header
  // Nếu không tìm thấy (trường hợp hiếm), quay về trang chủ '/'
  const retUrl = req.headers.referer || '/';
  res.redirect(retUrl);
});

// ROUTE 2: XÓA KHỎI WATCHLIST (DELETE)
router.delete('/watchlist', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  await watchListModel.removeFromWatchlist(userId, productId);

  // SỬA LẠI: Tương tự như trên
  const retUrl = req.headers.referer || '/';
  res.redirect(retUrl);
});

// ROUTE 3: ĐẶT GIÁ (POST) - Server-side rendering with automatic bidding
router.post('/bid', isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = parseInt(req.body.productId);
  const bidAmount = parseFloat(req.body.bidAmount.replace(/,/g, ''));

  try {
    const result = await auctionService.placeBid({ productId, userId, bidAmount });
    const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;

    // Fire-and-forget: non-blocking email dispatch
    auctionService.sendBidNotifications({ result, productId, productUrl });

    req.session.success_message = buildBidResponseMessage({ ...result, bidAmount });
    res.redirect(`/products/detail?id=${productId}`);

  } catch (error) {
    console.error('Bid error:', error);
    req.session.error_message = error.message || 'An error occurred while placing bid. Please try again.';
    res.redirect(`/products/detail?id=${productId}`);
  }
});

// ROUTE: POST COMMENT
router.post('/comment', isAuthenticated, async (req, res) => {
  const { productId, content, parentId } = req.body;
  const userId = req.session.authUser.id;

  try {
    if (!content || content.trim().length === 0) {
      req.session.error_message = 'Comment cannot be empty';
      return res.redirect(`/products/detail?id=${productId}`);
    }

    // Persist the comment
    await productCommentModel.createComment(productId, userId, content.trim(), parentId || null);

    // Fetch data required by notification service
    const [product, commenter] = await Promise.all([
      productModel.findByProductId2(productId, null),
      userModel.findById(userId)
    ]);
    const seller = await userModel.findById(product.seller_id);
    const productUrl = `${req.protocol}://${req.get('host')}/products/detail?id=${productId}`;

    // Fetch bidders + commenters only when the seller is broadcasting a reply
    const isSellerReplying = userId === product.seller_id;
    let bidders = [], commenters = [];
    if (isSellerReplying && parentId) {
      [bidders, commenters] = await Promise.all([
        biddingHistoryModel.getUniqueBidders(productId),
        productCommentModel.getUniqueCommenters(productId)
      ]);
    }

    // Fire-and-forget: delegate all email logic to notification service
    notificationService.sendCommentNotifications({
      product, commenter, seller, content: content.trim(), parentId, userId, productUrl, bidders, commenters
    });

    req.session.success_message = 'Comment posted successfully!';
    res.redirect(`/products/detail?id=${productId}`);

  } catch (error) {
    console.error('Post comment error:', error);
    req.session.error_message = 'Failed to post comment. Please try again.';
    res.redirect(`/products/detail?id=${productId}`);
  }
});


// ROUTE 4: GET BIDDING HISTORY
router.get('/bid-history/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingHistoryModel.getBiddingHistory(productId);
    res.json({ success: true, data: history });
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
    let rejectedBidderInfo = null;
    let productInfo = null;
    let sellerInfo = null;

    // Use transaction to ensure data consistency
    await db.transaction(async (trx) => {
      // 1. Lock and verify product ownership
      const product = await trx('products')
        .where('id', productId)
        .forUpdate()
        .first();

      if (!product) {
        throw new Error('Product not found');
      }

      if (product.seller_id !== sellerId) {
        throw new Error('Only the seller can reject bidders');
      }

      // Check product status - only allow rejection for ACTIVE products
      const now = new Date();
      const endDate = new Date(product.end_at);

      if (product.is_sold !== null || endDate <= now || product.closed_at) {
        throw new Error('Can only reject bidders for active auctions');
      }

      // 2. Check if bidder has actually bid on this product
      const autoBid = await trx('auto_bidding')
        .where('product_id', productId)
        .where('bidder_id', bidderId)
        .first();

      if (!autoBid) {
        throw new Error('This bidder has not placed a bid on this product');
      }

      // Get bidder info for email notification
      rejectedBidderInfo = await trx('users')
        .where('id', bidderId)
        .first();

      productInfo = product;
      sellerInfo = await trx('users')
        .where('id', sellerId)
        .first();

      // 3. Add to rejected_bidders table
      await trx('rejected_bidders').insert({
        product_id: productId,
        bidder_id: bidderId,
        seller_id: sellerId
      }).onConflict(['product_id', 'bidder_id']).ignore();

      // 4. Remove all bidding history of this bidder for this product
      await trx('bidding_history')
        .where('product_id', productId)
        .where('bidder_id', bidderId)
        .del();

      // 5. Remove from auto_bidding
      await trx('auto_bidding')
        .where('product_id', productId)
        .where('bidder_id', bidderId)
        .del();

      // 6. Recalculate highest bidder and current price
      // Always check remaining bidders after rejection
      const allAutoBids = await trx('auto_bidding')
        .where('product_id', productId)
        .orderBy('max_price', 'desc');

      const bidderIdNum = parseInt(bidderId);
      const highestBidderIdNum = parseInt(product.highest_bidder_id);
      const wasHighestBidder = (highestBidderIdNum === bidderIdNum);

      if (allAutoBids.length === 0) {
        // No more bidders - reset to starting state
        await trx('products')
          .where('id', productId)
          .update({
            highest_bidder_id: null,
            current_price: product.starting_price,
            highest_max_price: null
          });
        // Don't add bidding history - no one actually bid
      } else if (allAutoBids.length === 1) {
        // Only one bidder left - they win at starting price (no competition)
        const winner = allAutoBids[0];
        const newPrice = product.starting_price;

        await trx('products')
          .where('id', productId)
          .update({
            highest_bidder_id: winner.bidder_id,
            current_price: newPrice,
            highest_max_price: winner.max_price
          });

        // Add history entry only if price changed
        if (wasHighestBidder || product.current_price !== newPrice) {
          await trx('bidding_history').insert({
            product_id: productId,
            bidder_id: winner.bidder_id,
            current_price: newPrice
          });
        }
      } else if (wasHighestBidder) {
        // Multiple bidders and rejected was highest - recalculate price
        const firstBidder = allAutoBids[0];
        const secondBidder = allAutoBids[1];

        // Current price should be minimum to beat second highest
        let newPrice = secondBidder.max_price + product.step_price;

        // But cannot exceed first bidder's max
        if (newPrice > firstBidder.max_price) {
          newPrice = firstBidder.max_price;
        }

        await trx('products')
          .where('id', productId)
          .update({
            highest_bidder_id: firstBidder.bidder_id,
            current_price: newPrice,
            highest_max_price: firstBidder.max_price
          });

        // Add history entry only if price changed
        const lastHistory = await trx('bidding_history')
          .where('product_id', productId)
          .orderBy('created_at', 'desc')
          .first();

        if (!lastHistory || lastHistory.current_price !== newPrice) {
          await trx('bidding_history').insert({
            product_id: productId,
            bidder_id: firstBidder.bidder_id,
            current_price: newPrice
          });
        }
      }
      // If rejected bidder was NOT the highest bidder and still multiple bidders left, 
      // don't update anything - just removing them from auto_bidding is enough
    });

    // Send email notification to rejected bidder (outside transaction) - asynchronously
    if (rejectedBidderInfo && rejectedBidderInfo.email && productInfo) {
      // Don't await - send email in background
      sendMail({
        to: rejectedBidderInfo.email,
        subject: `Your bid has been rejected: ${productInfo.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Bid Rejected</h1>
            </div>
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p>Dear <strong>${rejectedBidderInfo.fullname}</strong>,</p>
              <p>We regret to inform you that the seller has rejected your bid on the following product:</p>
              <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #dc3545;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${productInfo.name}</h3>
                <p style="margin: 5px 0; color: #666;"><strong>Seller:</strong> ${sellerInfo ? sellerInfo.fullname : 'N/A'}</p>
              </div>
              <p style="color: #666;">This means you can no longer place bids on this specific product. Your previous bids on this product have been removed.</p>
              <p style="color: #666;">You can still participate in other auctions on our platform.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${req.protocol}://${req.get('host')}/" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Browse Other Auctions
                </a>
              </div>
              <p style="color: #888; font-size: 13px;">If you believe this was done in error, please contact our support team.</p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; text-align: center;">This is an automated message from Online Auction. Please do not reply to this email.</p>
          </div>
        `
      }).then(() => {
        console.log(`Rejection email sent to ${rejectedBidderInfo.email} for product #${productId}`);
      }).catch((emailError) => {
        console.error('Failed to send rejection email:', emailError);
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
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    // Verify product ownership
    const product = await productModel.findByProductId2(productId, sellerId);

    if (!product) {
      throw new Error('Product not found');
    }

    if (product.seller_id !== sellerId) {
      throw new Error('Only the seller can unreject bidders');
    }

    // Check product status - only allow unrejection for ACTIVE products
    const now = new Date();
    const endDate = new Date(product.end_at);

    if (product.is_sold !== null || endDate <= now || product.closed_at) {
      throw new Error('Can only unreject bidders for active auctions');
    }

    // Remove from rejected_bidders table
    await rejectedBidderModel.unrejectBidder(productId, bidderId);

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
    await auctionService.executeBuyNow({ productId, userId });
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

export default router;
