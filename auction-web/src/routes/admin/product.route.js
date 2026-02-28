import express from 'express';
import * as productModel from '../../models/product.model.js';
import * as userModel from '../../models/user.model.js';
import * as adminProductService from '../../services/admin.product.service.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

router.get('/list', async (req, res) => {
    const products = await productModel.findAll();
    const filteredProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        seller_name: p.seller_name,
        current_price: p.current_price,
        highest_bidder_name: p.highest_bidder_name
    }));
    res.render('vwAdmin/product/list', {
        products : filteredProducts,
        empty: products.length === 0
    });
});

// Middleware to load sellers for forms
router.use(['/add', '/edit/:id'], async (req, res, next) => {
    try {
        res.locals.sellers = await userModel.findUsersByRole('seller');
        next();
    } catch (error) {
        console.error('Error loading sellers:', error);
        res.locals.sellers = [];
        req.session.error_message = 'Failed to load sellers list';
        next();
    }
});

router.get('/add', async (req, res) => {
    res.render('vwAdmin/product/add');
});

router.post('/add', async function (req, res) {
    const product = req.body;
    const productData = {
        seller_id: product.seller_id,
        category_id: product.category_id,
        name: product.name,
        starting_price: product.start_price.replace(/,/g, ''),
        step_price: product.step_price.replace(/,/g, ''),
        buy_now_price: product.buy_now_price !== '' ? product.buy_now_price.replace(/,/g, '') : null,
        created_at: product.created_at,
        end_at: product.end_date,
        auto_extend: product.auto_extend === '1' ? true : false,
        thumbnail: null,  // to be updated after upload
        description: product.description,
        highest_bidder_id: null,
        current_price: product.start_price.replace(/,/g, ''),
        is_sold: null,
        closed_at: null,
        allow_unrated_bidder: product.allow_new_bidders === '1' ? true : false
    }
    const imgs = JSON.parse(product.imgs_list);

    await adminProductService.createProductWithImages(productData, product.thumbnail, imgs);
    res.redirect('/admin/products/list');
});
router.get('/detail/:id', async (req, res) => {
    const id = req.params.id;
    const product = await productModel.findByProductIdForAdmin(id);
    // console.log(product);
    res.render('vwAdmin/product/detail', { product } );
});

router.get('/edit/:id', async (req, res) => {
    const id = req.params.id;
    const product = await productModel.findByProductIdForAdmin(id);
    res.render('vwAdmin/product/edit', { product } );
});

router.post('/edit', async (req, res) => {
    const newProduct = req.body;
    await productModel.updateProduct(newProduct.id, newProduct);
    req.session.success_message = 'Product updated successfully!';
    res.redirect('/admin/products/list');
});

router.post('/delete', async (req, res) => {
    const { id } = req.body;
    await productModel.deleteProduct(id);
    req.session.success_message = 'Product deleted successfully!';
    res.redirect('/admin/products/list');
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

router.post('/upload-thumbnail', upload.single('thumbnail'), async function (req, res) {
    res.json({
        success: true,
        file: req.file
    });
});

router.post('/upload-subimages', upload.array('images', 10), async function (req, res) {
    res.json({
        success: true,
        files: req.files
    });
});

export default router;