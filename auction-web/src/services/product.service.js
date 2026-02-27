import * as productModel from '../models/product.model.js'
import * as productDescUpdateModel from '../models/productDescriptionUpdate.model.js';
import { formatAddProduct } from '../utils/product-formatter.js';
import * as fileService from './file.service.js';

export async function createProduct (product, sellerId) {
    const productData = formatAddProduct(product, sellerId);
    const returnedID = await productModel.addProduct(productData);
    const newProductId = returnedID[0].id;

    // Handle thumbnail upload and update product record
    if (product.thumbnail) {
        const savedThumbPath = fileService.moveAndRenameThumbnail(newProductId, product.thumbnail);
        await productModel.updateProductThumbnail(newProductId, savedThumbPath);
    }

    // Handle sub-images upload and update product record
    if (product.sub_images) {
        const newImgPaths = fileService.moveAndRenameSubImages(newProductId, product.imgs_list);
        if (newImgPaths.length > 0) {
            await productModel.addProductImages(newImgPaths);
        }
    }
    return newProductId;
}

export async function appendDescription (productId, sellerId, description) {
    // Check if product exists and belongs to the seller
    const product = await productModel.findByProductId2(productId, null);
    if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
    }
    if (product.seller_id !== sellerId) {
        throw new Error('UNAUTHORIZED');
    }

    // Update product description and log the update
    await productDescUpdateModel.addUpdate(productId, description);

    // Return the updated product details (including the new description)
    return product;
}