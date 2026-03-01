import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// Mock all dependencies before importing the route
jest.unstable_mockModule('../models/category.model.js', () => ({
  findByCategoryId: jest.fn(),
  findChildCategoryIds: jest.fn(),
}));

jest.unstable_mockModule('../models/product.model.js', () => ({
  findByCategoryIds: jest.fn(),
  countByCategoryIds: jest.fn(),
  searchPageByKeywords: jest.fn(),
  countByKeywords: jest.fn(),
  findByProductId2: jest.fn(),
  findByProductId: jest.fn(),
  findRelatedProducts: jest.fn(),
  updateProduct: jest.fn(),
}));

jest.unstable_mockModule('../models/systemSetting.model.js', () => ({
  getSettings: jest.fn(),
}));

jest.unstable_mockModule('../models/productDescriptionUpdate.model.js', () => ({
  findByProductId: jest.fn(),
}));

jest.unstable_mockModule('../models/biddingHistory.model.js', () => ({
  getBiddingHistory: jest.fn(),
  getUniqueBidders: jest.fn(),
}));

jest.unstable_mockModule('../models/productComment.model.js', () => ({
  getCommentsByProductId: jest.fn(),
  countCommentsByProductId: jest.fn(),
  getRepliesByCommentIds: jest.fn(),
  createComment: jest.fn(),
  getUniqueCommenters: jest.fn(),
}));

jest.unstable_mockModule('../models/rejectedBidder.model.js', () => ({
  getRejectedBidders: jest.fn(),
  unrejectBidder: jest.fn(),
}));

jest.unstable_mockModule('../models/review.model.js', () => ({
  calculateRatingPoint: jest.fn(),
  getReviewsByUserId: jest.fn(),
}));

jest.unstable_mockModule('../models/watchlist.model.js', () => ({
  isInWatchlist: jest.fn(),
  addToWatchlist: jest.fn(),
  removeFromWatchlist: jest.fn(),
}));

jest.unstable_mockModule('../models/user.model.js', () => ({
  findById: jest.fn(),
}));

jest.unstable_mockModule('../models/invoice.model.js', () => ({}));

jest.unstable_mockModule('../models/orderChat.model.js', () => ({}));

jest.unstable_mockModule('../models/autoBidding.model.js', () => ({}));

jest.unstable_mockModule('../services/order.service.js', () => ({
  buildCompleteOrderPageData: jest.fn(),
}));

jest.unstable_mockModule('../utils/db.js', () => ({
  default: {
    transaction: jest.fn(),
  }
}));

jest.unstable_mockModule('../utils/mailer.js', () => ({
  sendMail: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule('../utils/dbHelpers.js', () => ({
  parsePostgresArray: jest.fn((arr) => arr),
}));

jest.unstable_mockModule('../middlewares/auth.mdw.js', () => ({
  isAuthenticated: (req, res, next) => {
    if (req.session && req.session.authUser) {
      next();
    } else {
      res.status(401).send('Unauthorized');
    }
  },
}));

const categoryModel = await import('../models/category.model.js');
const productModel = await import('../models/product.model.js');
const systemSettingModel = await import('../models/systemSetting.model.js');
const productDescUpdateModel = await import('../models/productDescriptionUpdate.model.js');
const biddingHistoryModel = await import('../models/biddingHistory.model.js');
const productCommentModel = await import('../models/productComment.model.js');
const rejectedBidderModel = await import('../models/rejectedBidder.model.js');
const reviewModel = await import('../models/review.model.js');
const watchListModel = await import('../models/watchlist.model.js');
const userModel = await import('../models/user.model.js');
const orderService = await import('../services/order.service.js');
const db = (await import('../utils/db.js')).default;
const productRouter = (await import('../routes/product.route.js')).default;

describe('Product Routes', () => {
  let app;
  let testSession;

  beforeEach(() => {
    testSession = {}; // Reset session for each test

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use((req, res, next) => {
      req.session = testSession; // Use shared session object
      next();
    });

    // Mock res.render to avoid EJS dependency and prevent actual rendering
    app.use((req, res, next) => {
      res.render = function (view, locals, callback) {
        // Avoid actually rendering views - preserve status code if set
        if (!res.headersSent) {
          res.send('OK');
        }
      };
      next();
    });

    app.use('/products', productRouter);

    jest.clearAllMocks();
  });

  describe('GET /category', () => {
    it('should render product list for a category', async () => {
      const mockCategory = { id: 1, name: 'Electronics', parent_id: null };
      const mockProducts = [
        { id: 1, name: 'Product 1', created_at: new Date(), current_price: 100 }
      ];
      const mockTotal = { count: '1' };

      categoryModel.findByCategoryId.mockResolvedValue(mockCategory);
      categoryModel.findChildCategoryIds.mockResolvedValue([]);
      productModel.findByCategoryIds.mockResolvedValue(mockProducts);
      productModel.countByCategoryIds.mockResolvedValue(mockTotal);
      systemSettingModel.getSettings.mockResolvedValue({ new_product_limit_minutes: 60 });

      const res = await request(app)
        .get('/products/category?catid=1')
        .expect(200);

      expect(categoryModel.findByCategoryId).toHaveBeenCalledWith('1');
      expect(productModel.findByCategoryIds).toHaveBeenCalled();
      expect(productModel.countByCategoryIds).toHaveBeenCalled();
    });

    it('should include child categories for level 1 category', async () => {
      const mockCategory = { id: 1, name: 'Electronics', parent_id: null };
      const mockChildren = [{ id: 2 }, { id: 3 }];
      const mockProducts = [];
      const mockTotal = { count: '0' };

      categoryModel.findByCategoryId.mockResolvedValue(mockCategory);
      categoryModel.findChildCategoryIds.mockResolvedValue(mockChildren);
      productModel.findByCategoryIds.mockResolvedValue(mockProducts);
      productModel.countByCategoryIds.mockResolvedValue(mockTotal);
      systemSettingModel.getSettings.mockResolvedValue({ new_product_limit_minutes: 60 });

      await request(app)
        .get('/products/category?catid=1')
        .expect(200);

      expect(categoryModel.findChildCategoryIds).toHaveBeenCalledWith('1');
      expect(productModel.findByCategoryIds).toHaveBeenCalledWith(
        ['1', 2, 3],
        expect.any(Number),
        expect.any(Number),
        expect.any(String),
        null
      );
    });

    it('should handle pagination correctly', async () => {
      const mockCategory = { id: 1, name: 'Electronics', parent_id: 2 };
      const mockProducts = [];
      const mockTotal = { count: '10' };

      categoryModel.findByCategoryId.mockResolvedValue(mockCategory);
      productModel.findByCategoryIds.mockResolvedValue(mockProducts);
      productModel.countByCategoryIds.mockResolvedValue(mockTotal);
      systemSettingModel.getSettings.mockResolvedValue({ new_product_limit_minutes: 60 });

      await request(app)
        .get('/products/category?catid=1&page=2')
        .expect(200);

      expect(productModel.findByCategoryIds).toHaveBeenCalledWith(
        ['1'],
        3,
        3,
        '',
        null
      );
    });

    it('should apply sorting', async () => {
      const mockCategory = { id: 1, name: 'Electronics', parent_id: null };
      const mockProducts = [];
      const mockTotal = { count: '0' };

      categoryModel.findByCategoryId.mockResolvedValue(mockCategory);
      categoryModel.findChildCategoryIds.mockResolvedValue([]);
      productModel.findByCategoryIds.mockResolvedValue(mockProducts);
      productModel.countByCategoryIds.mockResolvedValue(mockTotal);
      systemSettingModel.getSettings.mockResolvedValue({ new_product_limit_minutes: 60 });

      await request(app)
        .get('/products/category?catid=1&sort=price_asc')
        .expect(200);

      expect(productModel.findByCategoryIds).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Number),
        expect.any(Number),
        'price_asc',
        null
      );
    });
  });

  describe('GET /search', () => {
    it('should return empty results for empty query', async () => {
      await request(app)
        .get('/products/search?q=')
        .expect(200);

      expect(productModel.searchPageByKeywords).not.toHaveBeenCalled();
    });

    it('should search products by keywords', async () => {
      const mockProducts = [
        { id: 1, name: 'Laptop', created_at: new Date() }
      ];
      const mockTotal = { count: '1' };

      productModel.searchPageByKeywords.mockResolvedValue(mockProducts);
      productModel.countByKeywords.mockResolvedValue(mockTotal);
      systemSettingModel.getSettings.mockResolvedValue({ new_product_limit_minutes: 60 });

      await request(app)
        .get('/products/search?q=laptop')
        .expect(200);

      expect(productModel.searchPageByKeywords).toHaveBeenCalledWith(
        'laptop',
        3,
        0,
        null,
        'and',
        ''
      );
      expect(productModel.countByKeywords).toHaveBeenCalledWith('laptop', 'and');
    });

    it('should handle OR logic search', async () => {
      const mockProducts = [];
      const mockTotal = { count: '0' };

      productModel.searchPageByKeywords.mockResolvedValue(mockProducts);
      productModel.countByKeywords.mockResolvedValue(mockTotal);
      systemSettingModel.getSettings.mockResolvedValue({ new_product_limit_minutes: 60 });

      await request(app)
        .get('/products/search?q=laptop+phone&logic=or')
        .expect(200);

      expect(productModel.searchPageByKeywords).toHaveBeenCalledWith(
        'laptop phone',
        3,
        0,
        null,
        'or',
        ''
      );
    });

    it('should handle pagination in search', async () => {
      const mockProducts = [];
      const mockTotal = { count: '10' };

      productModel.searchPageByKeywords.mockResolvedValue(mockProducts);
      productModel.countByKeywords.mockResolvedValue(mockTotal);
      systemSettingModel.getSettings.mockResolvedValue({ new_product_limit_minutes: 60 });

      await request(app)
        .get('/products/search?q=test&page=3')
        .expect(200);

      expect(productModel.searchPageByKeywords).toHaveBeenCalledWith(
        'test',
        3,
        6,
        null,
        'and',
        ''
      );
    });

    it('should apply sorting in search', async () => {
      const mockProducts = [];
      const mockTotal = { count: '0' };

      productModel.searchPageByKeywords.mockResolvedValue(mockProducts);
      productModel.countByKeywords.mockResolvedValue(mockTotal);
      systemSettingModel.getSettings.mockResolvedValue({ new_product_limit_minutes: 60 });

      await request(app)
        .get('/products/search?q=test&sort=price_desc')
        .expect(200);

      expect(productModel.searchPageByKeywords).toHaveBeenCalledWith(
        'test',
        3,
        0,
        null,
        'and',
        'price_desc'
      );
    });
  });

  describe('GET /detail', () => {
    it('should render product details for active product', async () => {
      const mockProduct = {
        id: 1,
        name: 'Product 1',
        seller_id: 10,
        highest_bidder_id: null,
        is_sold: null,
        created_at: new Date(),
        end_at: new Date(Date.now() + 86400000),
        closed_at: null
      };

      productModel.findByProductId2.mockResolvedValue(mockProduct);
      productModel.findRelatedProducts.mockResolvedValue([]);
      productDescUpdateModel.findByProductId.mockResolvedValue([]);
      biddingHistoryModel.getBiddingHistory.mockResolvedValue([]);
      productCommentModel.getCommentsByProductId.mockResolvedValue([]);
      productCommentModel.countCommentsByProductId.mockResolvedValue(0);
      rejectedBidderModel.getRejectedBidders.mockResolvedValue([]);
      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 80 });
      reviewModel.getReviewsByUserId.mockResolvedValue([]);

      await request(app)
        .get('/products/detail?id=1')
        .expect(200);

      expect(productModel.findByProductId2).toHaveBeenCalledWith('1', null);
    });

    it('should return 404 for non-existent product', async () => {
      productModel.findByProductId2.mockResolvedValue(null);

      await request(app)
        .get('/products/detail?id=999')
        .expect(404);
    });

    it('should auto-close expired auction', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      const mockProduct = {
        id: 1,
        name: 'Product 1',
        seller_id: 10,
        highest_bidder_id: 5,
        is_sold: null,
        created_at: new Date(),
        end_at: pastDate,
        closed_at: null
      };

      productModel.findByProductId2.mockResolvedValue(mockProduct);
      productModel.updateProduct.mockResolvedValue({});
      productModel.findRelatedProducts.mockResolvedValue([]);
      productDescUpdateModel.findByProductId.mockResolvedValue([]);
      biddingHistoryModel.getBiddingHistory.mockResolvedValue([]);
      productCommentModel.getCommentsByProductId.mockResolvedValue([]);
      productCommentModel.countCommentsByProductId.mockResolvedValue(0);
      rejectedBidderModel.getRejectedBidders.mockResolvedValue([]);
      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 80 });
      reviewModel.getReviewsByUserId.mockResolvedValue([]);

      testSession.authUser = { id: 10 }; // Log in as seller to view the product

      await request(app)
        .get('/products/detail?id=1')
        .expect(200);

      expect(productModel.updateProduct).toHaveBeenCalledWith('1', { closed_at: pastDate });
    });

    it('should restrict access to sold products for non-participants', async () => {
      const mockProduct = {
        id: 1,
        name: 'Product 1',
        seller_id: 10,
        highest_bidder_id: 5,
        is_sold: true,
        created_at: new Date(),
        end_at: new Date(),
        closed_at: new Date()
      };

      productModel.findByProductId2.mockResolvedValue(mockProduct);

      await request(app)
        .get('/products/detail?id=1')
        .expect(403);
    });

    it('should allow seller to view sold product', async () => {
      const mockProduct = {
        id: 1,
        name: 'Product 1',
        seller_id: 10,
        highest_bidder_id: 5,
        is_sold: true,
        created_at: new Date(),
        end_at: new Date(),
        closed_at: new Date()
      };

      productModel.findByProductId2.mockResolvedValue(mockProduct);
      productModel.findRelatedProducts.mockResolvedValue([]);
      productDescUpdateModel.findByProductId.mockResolvedValue([]);
      biddingHistoryModel.getBiddingHistory.mockResolvedValue([]);
      productCommentModel.getCommentsByProductId.mockResolvedValue([]);
      productCommentModel.countCommentsByProductId.mockResolvedValue(0);
      rejectedBidderModel.getRejectedBidders.mockResolvedValue([]);
      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 80 });
      reviewModel.getReviewsByUserId.mockResolvedValue([]);

      testSession.authUser = { id: 10 };

      await request(app)
        .get('/products/detail?id=1')
        .expect(200);
    });

    it('should load comments with pagination', async () => {
      const mockProduct = {
        id: 1,
        name: 'Product 1',
        seller_id: 10,
        highest_bidder_id: null,
        is_sold: null,
        created_at: new Date(),
        end_at: new Date(Date.now() + 86400000),
        closed_at: null
      };

      productModel.findByProductId2.mockResolvedValue(mockProduct);
      productModel.findRelatedProducts.mockResolvedValue([]);
      productDescUpdateModel.findByProductId.mockResolvedValue([]);
      biddingHistoryModel.getBiddingHistory.mockResolvedValue([]);
      productCommentModel.getCommentsByProductId.mockResolvedValue([]);
      productCommentModel.countCommentsByProductId.mockResolvedValue(10);
      rejectedBidderModel.getRejectedBidders.mockResolvedValue([]);
      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 80 });
      reviewModel.getReviewsByUserId.mockResolvedValue([]);

      await request(app)
        .get('/products/detail?id=1&commentPage=2')
        .expect(200);

      expect(productCommentModel.getCommentsByProductId).toHaveBeenCalledWith('1', 2, 2);
    });

    it('should load and group comment replies', async () => {
      const mockProduct = {
        id: 1,
        name: 'Product 1',
        seller_id: 10,
        highest_bidder_id: null,
        is_sold: null,
        created_at: new Date(),
        end_at: new Date(Date.now() + 86400000),
        closed_at: null
      };
      const mockComments = [
        { id: 100, content: 'Comment 1' },
        { id: 101, content: 'Comment 2' }
      ];
      const mockReplies = [
        { id: 200, parent_id: 100, content: 'Reply 1' }
      ];

      productModel.findByProductId2.mockResolvedValue(mockProduct);
      productModel.findRelatedProducts.mockResolvedValue([]);
      productDescUpdateModel.findByProductId.mockResolvedValue([]);
      biddingHistoryModel.getBiddingHistory.mockResolvedValue([]);
      productCommentModel.getCommentsByProductId.mockResolvedValue(mockComments);
      productCommentModel.countCommentsByProductId.mockResolvedValue(2);
      productCommentModel.getRepliesByCommentIds.mockResolvedValue(mockReplies);
      rejectedBidderModel.getRejectedBidders.mockResolvedValue([]);
      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 80 });
      reviewModel.getReviewsByUserId.mockResolvedValue([]);

      await request(app)
        .get('/products/detail?id=1')
        .expect(200);

      expect(productCommentModel.getRepliesByCommentIds).toHaveBeenCalledWith([100, 101]);
    });
  });

  describe('GET /bidding-history', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/products/bidding-history?id=1')
        .expect(401);
    });

    it('should redirect to home if no product id', async () => {
      testSession.authUser = { id: 1 };

      const res = await request(app)
        .get('/products/bidding-history')
        .expect(302);

      expect(res.header.location).toBe('/');
    });

    it('should render bidding history page for authenticated user', async () => {
      const mockProduct = { id: 1, name: 'Product 1' };
      const mockHistory = [{ id: 1, bid_amount: 100 }];

      productModel.findByProductId2.mockResolvedValue(mockProduct);
      biddingHistoryModel.getBiddingHistory.mockResolvedValue(mockHistory);

      testSession.authUser = { id: 1 };

      await request(app)
        .get('/products/bidding-history?id=1')
        .expect(200);

      expect(biddingHistoryModel.getBiddingHistory).toHaveBeenCalledWith('1');
    });

    it('should return 404 if product not found', async () => {
      productModel.findByProductId2.mockResolvedValue(null);

      testSession.authUser = { id: 1 };

      await request(app)
        .get('/products/bidding-history?id=999')
        .expect(404);
    });
  });

  describe('POST /watchlist', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/products/watchlist')
        .send({ productId: 1 })
        .expect(401);
    });

    it('should add product to watchlist', async () => {
      watchListModel.isInWatchlist.mockResolvedValue(false);
      watchListModel.addToWatchlist.mockResolvedValue({});

      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/watchlist')
        .send({ productId: 1 })
        .expect(302);

      expect(watchListModel.addToWatchlist).toHaveBeenCalledWith(5, 1);
    });

    it('should not add if already in watchlist', async () => {
      watchListModel.isInWatchlist.mockResolvedValue(true);

      testSession.authUser = { id: 5 };

      await request(app)
        .post('/products/watchlist')
        .send({ productId: 1 })
        .expect(302);

      expect(watchListModel.addToWatchlist).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /watchlist', () => {
    it('should require authentication', async () => {
      await request(app)
        .delete('/products/watchlist')
        .send({ productId: 1 })
        .expect(401);
    });

    it('should remove product from watchlist', async () => {
      watchListModel.removeFromWatchlist.mockResolvedValue({});

      testSession.authUser = { id: 5 };

      await request(app)
        .delete('/products/watchlist')
        .send({ productId: 1 })
        .expect(302);

      expect(watchListModel.removeFromWatchlist).toHaveBeenCalledWith(5, 1);
    });
  });

  describe('POST /bid', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/products/bid')
        .send({ productId: 1, bidAmount: '100' })
        .expect(401);
    });

    it('should place a successful bid', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        current_price: 100,
        starting_price: 50,
        step_price: 10,
        end_at: new Date(Date.now() + 86400000),
        is_sold: null,
        highest_bidder_id: null,
        highest_max_price: null,
        auto_extend: false,
        buy_now_price: null,
        name: 'Product 1'
      };

      const mockTrx = {
        raw: jest.fn().mockResolvedValue({}),
      };
      mockTrx.mockReturnValue = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        forUpdate: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockProduct),
        update: jest.fn().mockResolvedValue({}),
        insert: jest.fn().mockResolvedValue({}),
      });

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => {
          const query = {
            where: jest.fn().mockReturnThis(),
            forUpdate: jest.fn().mockReturnThis(),
            first: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
            insert: jest.fn().mockResolvedValue({}),
          };

          if (table === 'products') {
            query.first.mockResolvedValue(mockProduct);
          } else if (table === 'rejected_bidders') {
            query.first.mockResolvedValue(null);
          } else if (table === 'auto_bidding') {
            query.first.mockResolvedValue(null);
          }

          return query;
        };
        trxMock.raw = jest.fn().mockResolvedValue({});
        return await callback(trxMock);
      });

      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 80 });
      reviewModel.getReviewsByUserId.mockResolvedValue([{ id: 1 }]);

      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/bid')
        .send({ productId: 1, bidAmount: '120' })
        .expect(302);

      expect(res.header.location).toBe('/products/detail?id=1');
    });

    it('should reject bid if user is seller', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 5,
        current_price: 100,
        end_at: new Date(Date.now() + 86400000),
        is_sold: null,
      };

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => ({
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(table === 'products' ? mockProduct : null),
        });
        return await callback(trxMock);
      });

      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/bid')
        .send({ productId: 1, bidAmount: '120' })
        .expect(302);

      expect(res.header.location).toBe('/products/detail?id=1');
    });

    it('should reject bid if auction ended', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        current_price: 100,
        end_at: new Date(Date.now() - 86400000),
        is_sold: null,
      };

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => ({
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(table === 'products' ? mockProduct : null),
        });
        return await callback(trxMock);
      });

      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 80 });
      reviewModel.getReviewsByUserId.mockResolvedValue([{ id: 1 }]);

      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/bid')
        .send({ productId: 1, bidAmount: '120' })
        .expect(302);

      expect(res.header.location).toBe('/products/detail?id=1');
    });

    it('should reject bid if bidder is rejected', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        current_price: 100,
        end_at: new Date(Date.now() + 86400000),
        is_sold: null,
      };

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => {
          const query = {
            where: jest.fn().mockReturnThis(),
            forUpdate: jest.fn().mockReturnThis(),
            first: jest.fn(),
          };

          if (table === 'products') {
            query.first.mockResolvedValue(mockProduct);
          } else if (table === 'rejected_bidders') {
            query.first.mockResolvedValue({ bidder_id: 5 });
          }

          return query;
        };
        return await callback(trxMock);
      });

      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/bid')
        .send({ productId: 1, bidAmount: '120' })
        .expect(302);

      expect(res.header.location).toBe('/products/detail?id=1');
    });

    it('should reject bid if rating too low', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        current_price: 100,
        end_at: new Date(Date.now() + 86400000),
        is_sold: null,
      };

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => ({
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(table === 'products' ? mockProduct : null),
        });
        return await callback(trxMock);
      });

      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 60 });
      reviewModel.getReviewsByUserId.mockResolvedValue([{ id: 1 }]);

      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/bid')
        .send({ productId: 1, bidAmount: '120' })
        .expect(302);

      expect(res.header.location).toBe('/products/detail?id=1');
    });

    it('should reject bid if no reviews exist', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        current_price: 100,
        end_at: new Date(Date.now() + 86400000),
        is_sold: null,
      };

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => ({
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(table === 'products' ? mockProduct : null),
        });
        return await callback(trxMock);
      });

      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 80 });
      reviewModel.getReviewsByUserId.mockResolvedValue([]);

      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/bid')
        .send({ productId: 1, bidAmount: '120' })
        .expect(302);

      expect(res.header.location).toBe('/products/detail?id=1');
    });

    it('should reject bid below minimum increment', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        current_price: 100,
        step_price: 10,
        starting_price: 50,
        end_at: new Date(Date.now() + 86400000),
        is_sold: null,
      };

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => ({
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(table === 'products' ? mockProduct : null),
        });
        return await callback(trxMock);
      });

      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 80 });
      reviewModel.getReviewsByUserId.mockResolvedValue([{ id: 1 }]);

      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/bid')
        .send({ productId: 1, bidAmount: '105' })
        .expect(302);

      expect(res.header.location).toBe('/products/detail?id=1');
    });
  });

  describe('GET /complete-order', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/products/complete-order?id=1')
        .expect(401);
    });

    it('should redirect if no product id', async () => {
      testSession.authUser = { id: 1 };

      const res = await request(app)
        .get('/products/complete-order')
        .expect(302);

      expect(res.header.location).toBe('/');
    });

    it('should render complete order page', async () => {
      const mockViewData = {
        product: { id: 1, name: 'Product 1' },
        invoice: {},
      };

      orderService.buildCompleteOrderPageData.mockResolvedValue(mockViewData);

      testSession.authUser = { id: 1 };

      await request(app)
        .get('/products/complete-order?id=1')
        .expect(200);

      expect(orderService.buildCompleteOrderPageData).toHaveBeenCalledWith('1', 1);
    });

    it('should handle PRODUCT_NOT_FOUND error', async () => {
      const error = new Error('Product not found');
      error.code = 'PRODUCT_NOT_FOUND';
      orderService.buildCompleteOrderPageData.mockRejectedValue(error);

      testSession.authUser = { id: 1 };

      await request(app)
        .get('/products/complete-order?id=999')
        .expect(404);
    });

    it('should handle NOT_PENDING error', async () => {
      const error = new Error('Not pending');
      error.code = 'NOT_PENDING';
      orderService.buildCompleteOrderPageData.mockRejectedValue(error);

      testSession.authUser = { id: 1 };

      await request(app)
        .get('/products/complete-order?id=1')
        .expect(400);
    });

    it('should handle FORBIDDEN error', async () => {
      const error = new Error('Forbidden');
      error.code = 'FORBIDDEN';
      orderService.buildCompleteOrderPageData.mockRejectedValue(error);

      testSession.authUser = { id: 1 };

      await request(app)
        .get('/products/complete-order?id=1')
        .expect(403);
    });
  });

  describe('POST /comment', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/products/comment')
        .send({ productId: 1, content: 'Test comment' })
        .expect(401);
    });

    it('should create a comment', async () => {
      const mockProduct = { id: 1, seller_id: 10 };
      const mockCommenter = { id: 5, email: 'user@test.com' };
      const mockSeller = { id: 10, email: 'seller@test.com' };

      productCommentModel.createComment.mockResolvedValue({});
      productModel.findByProductId2.mockResolvedValue(mockProduct);
      userModel.findById.mockImplementation((id) => {
        if (id === 5) return Promise.resolve(mockCommenter);
        if (id === 10) return Promise.resolve(mockSeller);
      });

      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/comment')
        .send({ productId: 1, content: 'Great product!' })
        .expect(302);

      expect(productCommentModel.createComment).toHaveBeenCalledWith(
        '1',
        5,
        'Great product!',
        null
      );
      expect(res.header.location).toBe('/products/detail?id=1');
    });

    it('should reject empty comment', async () => {
      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/comment')
        .send({ productId: 1, content: '   ' })
        .expect(302);

      expect(productCommentModel.createComment).not.toHaveBeenCalled();
      expect(res.header.location).toBe('/products/detail?id=1');
    });

    it('should handle reply to comment', async () => {
      const mockProduct = { id: 1, seller_id: 10 };
      const mockCommenter = { id: 5, email: 'user@test.com' };
      const mockSeller = { id: 10, email: 'seller@test.com' };

      productCommentModel.createComment.mockResolvedValue({});
      productModel.findByProductId2.mockResolvedValue(mockProduct);
      userModel.findById.mockImplementation((id) => {
        if (id === 5) return Promise.resolve(mockCommenter);
        if (id === 10) return Promise.resolve(mockSeller);
      });

      testSession.authUser = { id: 5 };

      await request(app)
        .post('/products/comment')
        .send({ productId: 1, content: 'Reply!', parentId: 100 })
        .expect(302);

      expect(productCommentModel.createComment).toHaveBeenCalledWith(
        '1',
        5,
        'Reply!',
        100
      );
    });

    it('should notify bidders and commenters when seller replies', async () => {
      const mockProduct = { id: 1, seller_id: 5 };
      const mockSeller = { id: 5, email: 'seller@test.com' };
      const mockBidders = [{ id: 10, email: 'bidder@test.com' }];
      const mockCommenters = [{ id: 15, email: 'commenter@test.com' }];

      productCommentModel.createComment.mockResolvedValue({});
      productModel.findByProductId2.mockResolvedValue(mockProduct);
      userModel.findById.mockResolvedValue(mockSeller);
      biddingHistoryModel.getUniqueBidders.mockResolvedValue(mockBidders);
      productCommentModel.getUniqueCommenters.mockResolvedValue(mockCommenters);

      testSession.authUser = { id: 5 };

      await request(app)
        .post('/products/comment')
        .send({ productId: 1, content: 'Answer from seller', parentId: 100 })
        .expect(302);

      expect(biddingHistoryModel.getUniqueBidders).toHaveBeenCalledWith('1');
      expect(productCommentModel.getUniqueCommenters).toHaveBeenCalledWith('1');
    });
  });

  describe('GET /bid-history/:productId', () => {
    it('should return bidding history as JSON', async () => {
      const mockHistory = [
        { id: 1, bidder_id: 5, bid_amount: 100 },
        { id: 2, bidder_id: 6, bid_amount: 120 }
      ];

      biddingHistoryModel.getBiddingHistory.mockResolvedValue(mockHistory);
      productModel.findByProductId.mockResolvedValue([{
        id: 1,
        thumbnail: 'thumb.jpg',
        img_link: null,
        name: 'Product 1',
        starting_price: 50,
        current_price: 120,
        seller_id: 10,
        seller_name: 'Seller',
        seller_rating_plus: 10,
        seller_rating_minus: 2,
        seller_created_at: new Date(),
        buy_now_price: 200,
        highest_bidder_id: 6,
        bidder_name: 'Bidder',
        category_name: 'Electronics',
        bid_count: 5,
        created_at: new Date(),
        end_at: new Date(),
        description: 'Description'
      }]);
      productModel.findRelatedProducts.mockResolvedValue([]);

      const res = await request(app)
        .get('/products/bid-history/1')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockHistory);
    });

    it('should handle errors gracefully', async () => {
      biddingHistoryModel.getBiddingHistory.mockRejectedValue(new Error('DB error'));
      // Mock these since the route has unreachable code that still executes
      productModel.findByProductId.mockResolvedValue([{
        id: 1,
        thumbnail: 'thumb.jpg',
        img_link: null,
        name: 'Product 1',
        starting_price: 50,
        current_price: 120,
        seller_id: 10,
        seller_name: 'Seller',
        seller_rating_plus: 10,
        seller_rating_minus: 2,
        seller_created_at: new Date(),
        buy_now_price: 200,
        highest_bidder_id: 6,
        bidder_name: 'Bidder',
        category_name: 'Electronics',
        bid_count: 5,
        created_at: new Date(),
        end_at: new Date(),
        description: 'Description'
      }]);
      productModel.findRelatedProducts.mockResolvedValue([]);

      await request(app)
        .get('/products/bid-history/1')
        .expect(500);
    });
  });

  describe('POST /reject-bidder', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/products/reject-bidder')
        .send({ productId: 1, bidderId: 5 })
        .expect(401);
    });

    it('should reject bidder successfully', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        is_sold: null,
        end_at: new Date(Date.now() + 86400000),
        closed_at: null,
        highest_bidder_id: 5,
        current_price: 100,
        starting_price: 50,
        step_price: 10
      };

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => {
          const query = {
            where: jest.fn().mockReturnThis(),
            forUpdate: jest.fn().mockReturnThis(),
            first: jest.fn(),
            select: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            onConflict: jest.fn().mockReturnThis(),
            ignore: jest.fn().mockResolvedValue({}),
            del: jest.fn().mockResolvedValue({}),
            orderBy: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
          };

          if (table === 'products') {
            query.first.mockResolvedValue(mockProduct);
          } else if (table === 'auto_bidding') {
            query.first.mockResolvedValue({ bidder_id: 5, max_price: 100 });
          } else if (table === 'users') {
            query.first.mockResolvedValue({ id: 5, email: 'bidder@test.com', fullname: 'Test Bidder' });
          }

          return query;
        };
        return await callback(trxMock);
      });

      testSession.authUser = { id: 10 };

      const res = await request(app)
        .post('/products/reject-bidder')
        .send({ productId: 1, bidderId: 5 })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should reject if not seller', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        is_sold: null,
        end_at: new Date(Date.now() + 86400000),
      };

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => ({
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(table === 'products' ? mockProduct : null),
        });
        return await callback(trxMock);
      });

      testSession.authUser = { id: 99 };

      await request(app)
        .post('/products/reject-bidder')
        .send({ productId: 1, bidderId: 5 })
        .expect(400);
    });

    it('should reject if product not found', async () => {
      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => ({
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(null),
        });
        return await callback(trxMock);
      });

      testSession.authUser = { id: 10 };

      await request(app)
        .post('/products/reject-bidder')
        .send({ productId: 999, bidderId: 5 })
        .expect(400);
    });

    it('should reject if auction not active', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        is_sold: true,
        end_at: new Date(),
        closed_at: new Date()
      };

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => ({
          where: jest.fn().mockReturnThis(),
          forUpdate: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(table === 'products' ? mockProduct : null),
        });
        return await callback(trxMock);
      });

      testSession.authUser = { id: 10 };

      await request(app)
        .post('/products/reject-bidder')
        .send({ productId: 1, bidderId: 5 })
        .expect(400);
    });

    it('should reject if bidder has not bid', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        is_sold: null,
        end_at: new Date(Date.now() + 86400000),
        closed_at: null
      };

      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => {
          const query = {
            where: jest.fn().mockReturnThis(),
            forUpdate: jest.fn().mockReturnThis(),
            first: jest.fn(),
          };

          if (table === 'products') {
            query.first.mockResolvedValue(mockProduct);
          } else if (table === 'auto_bidding') {
            query.first.mockResolvedValue(null);
          }

          return query;
        };
        return await callback(trxMock);
      });

      testSession.authUser = { id: 10 };

      await request(app)
        .post('/products/reject-bidder')
        .send({ productId: 1, bidderId: 5 })
        .expect(400);
    });
  });

  describe('POST /unreject-bidder', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/products/unreject-bidder')
        .send({ productId: 1, bidderId: 5 })
        .expect(401);
    });

    it('should unreject bidder successfully', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        is_sold: null,
        end_at: new Date(Date.now() + 86400000),
        closed_at: null
      };

      productModel.findByProductId2.mockResolvedValue(mockProduct);
      rejectedBidderModel.unrejectBidder.mockResolvedValue({});

      testSession.authUser = { id: 10 };

      const res = await request(app)
        .post('/products/unreject-bidder')
        .send({ productId: 1, bidderId: 5 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(rejectedBidderModel.unrejectBidder).toHaveBeenCalledWith('1', '5');
    });

    it('should reject if not seller', async () => {
      const mockProduct = {
        id: 1,
        seller_id: 10,
        is_sold: null,
        end_at: new Date(Date.now() + 86400000),
      };

      productModel.findByProductId2.mockResolvedValue(mockProduct);

      testSession.authUser = { id: 99 };

      await request(app)
        .post('/products/unreject-bidder')
        .send({ productId: 1, bidderId: 5 })
        .expect(400);
    });

    it('should reject if product not found', async () => {
      productModel.findByProductId2.mockResolvedValue(null);

      testSession.authUser = { id: 10 };

      await request(app)
        .post('/products/unreject-bidder')
        .send({ productId: 999, bidderId: 5 })
        .expect(400);
    });
  });

  describe('POST /buy-now', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/products/buy-now')
        .send({ productId: 1 })
        .expect(401);
    });

    it('should handle buy now purchase', async () => {
      db.transaction.mockImplementation(async (callback) => {
        const trxMock = (table) => {
          const mockData = {
            products: {
              id: 1,
              seller_id: 10,
              is_sold: null,
              end_at: new Date(Date.now() + 86400000),
              closed_at: null,
              buy_now_price: 1000,
              allow_unrated_bidder: true
            },
            rejected_bidders: null,
            users: { id: 5 }
          };

          return {
            leftJoin: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            forUpdate: jest.fn().mockReturnThis(),
            first: jest.fn().mockResolvedValue(mockData[table] || null),
            update: jest.fn().mockResolvedValue({}),
            insert: jest.fn().mockResolvedValue({}),
          };
        };
        return await callback(trxMock);
      });

      testSession.authUser = { id: 5 };

      const res = await request(app)
        .post('/products/buy-now')
        .send({ productId: 1 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.redirectUrl).toBe('/products/complete-order?id=1');
    });
  });

  describe('GET /seller/:sellerId/ratings', () => {
    it('should render seller ratings page', async () => {
      const mockSeller = { id: 10, fullname: 'John Seller' };
      const mockReviews = [
        { id: 1, rating: 1, comment: 'Good' },
        { id: 2, rating: -1, comment: 'Bad' }
      ];

      userModel.findById.mockResolvedValue(mockSeller);
      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 75 });
      reviewModel.getReviewsByUserId.mockResolvedValue(mockReviews);

      await request(app)
        .get('/products/seller/10/ratings')
        .expect(200);

      expect(userModel.findById).toHaveBeenCalledWith(10);
      expect(reviewModel.calculateRatingPoint).toHaveBeenCalledWith(10);
      expect(reviewModel.getReviewsByUserId).toHaveBeenCalledWith(10);
    });

    it('should redirect if seller not found', async () => {
      userModel.findById.mockResolvedValue(null);

      const res = await request(app)
        .get('/products/seller/999/ratings')
        .expect(302);

      expect(res.header.location).toBe('/');
    });

    it('should redirect if invalid sellerId', async () => {
      const res = await request(app)
        .get('/products/seller/invalid/ratings')
        .expect(302);

      expect(res.header.location).toBe('/');
    });
  });

  describe('GET /bidder/:bidderId/ratings', () => {
    it('should render bidder ratings page with masked name', async () => {
      const mockBidder = { id: 15, fullname: 'Jane Bidder' };
      const mockReviews = [
        { id: 1, rating: 1, comment: 'Reliable' }
      ];

      userModel.findById.mockResolvedValue(mockBidder);
      reviewModel.calculateRatingPoint.mockResolvedValue({ rating_point: 85 });
      reviewModel.getReviewsByUserId.mockResolvedValue(mockReviews);

      await request(app)
        .get('/products/bidder/15/ratings')
        .expect(200);

      expect(userModel.findById).toHaveBeenCalledWith(15);
      expect(reviewModel.calculateRatingPoint).toHaveBeenCalledWith(15);
      expect(reviewModel.getReviewsByUserId).toHaveBeenCalledWith(15);
    });

    it('should redirect if bidder not found', async () => {
      userModel.findById.mockResolvedValue(null);

      const res = await request(app)
        .get('/products/bidder/999/ratings')
        .expect(302);

      expect(res.header.location).toBe('/');
    });

    it('should redirect if invalid bidderId', async () => {
      const res = await request(app)
        .get('/products/bidder/invalid/ratings')
        .expect(302);

      expect(res.header.location).toBe('/');
    });
  });
});
