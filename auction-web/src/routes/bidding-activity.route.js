import express from 'express';
import { isAuthenticated } from '../middlewares/auth.mdw.js';
import * as watchlistModel from '../models/watchlist.model.js';
import * as autoBiddingModel from '../models/autoBidding.model.js';
import * as reviewModel from '../models/review.model.js';

const router = express.Router();

router.get('/watchlist', isAuthenticated ,async (req, res) => {
  const limit = 3;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;
  const currentUserId = req.session.authUser.id;
  const watchlistProducts = await watchlistModel.searchPageByUserId(currentUserId, limit, offset);
  const total = await watchlistModel.countByUserId(currentUserId);
  const totalCount = Number(total.count);
  const nPages = Math.ceil(totalCount / limit);
  let from = (page - 1) * limit + 1;
  let to = page * limit;
  if (to > totalCount) to = totalCount;
  if (totalCount === 0) { from = 0; to = 0; }
  res.render('vwAccount/watchlist', {
    products: watchlistProducts,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
  });
});

// Bidding Products - Sản phẩm đang tham gia đấu giá
router.get('/bidding', isAuthenticated, async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const biddingProducts = await autoBiddingModel.getBiddingProductsByBidderId(currentUserId);
  
  res.render('vwAccount/bidding-products', {
    activeSection: 'bidding',
    products: biddingProducts
  });
});

// Won Auctions - Sản phẩm đã thắng (pending, sold, cancelled)
router.get('/auctions', isAuthenticated, async (req, res) => {
  const currentUserId = req.session.authUser.id;
  const wonAuctions = await autoBiddingModel.getWonAuctionsByBidderId(currentUserId);
  
  // Check if user has rated seller for each product
  for (let product of wonAuctions) {
    const review = await reviewModel.findByReviewerAndProduct(currentUserId, product.id);
    // Only show rating if it's not 0 (actual rating, not skip)
    if (review && review.rating !== 0) {
      product.has_rated_seller = true;
      product.seller_rating = review.rating === 1 ? 'positive' : 'negative';
      product.seller_rating_comment = review.comment;
    } else {
      product.has_rated_seller = false;
    }
  }
  
  res.render('vwAccount/won-auctions', {
    activeSection: 'auctions',
    products: wonAuctions
  });
});

export default router;
