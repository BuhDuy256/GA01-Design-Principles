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

// Seller dashboard and product listing
export async function getSellerStats(sellerId) {
    return await productModel.getSellerStats(sellerId);
}

export async function findAllProductsBySellerId(sellerId) {
    return await productModel.findAllProductsBySellerId(sellerId);
}

export async function findActiveProductsBySellerId(sellerId) {
    return await productModel.findActiveProductsBySellerId(sellerId);
}

export async function findPendingProductsBySellerId(sellerId) {
    return await productModel.findPendingProductsBySellerId(sellerId);
}

export async function getPendingProductsStats(sellerId) {
    return await productModel.getPendingProductsStats(sellerId);
}

export async function findSoldProductsBySellerId(sellerId) {
    return await productModel.findSoldProductsBySellerId(sellerId);
}

export async function getSoldProductsStats(sellerId) {
    return await productModel.getSoldProductsStats(sellerId);
}

export async function findExpiredProductsBySellerId(sellerId) {
    return await productModel.findExpiredProductsBySellerId(sellerId);
}

// Product cancellation
export async function cancelProduct(productId, sellerId) {
    return await productModel.cancelProduct(productId, sellerId);
}

// Verify product ownership helper
async function verifyProductOwnership(productId, sellerId) {
    const product = await productModel.findByProductId2(productId, null);
    if (!product) {
        const error = new Error('Product not found');
        error.code = 'PRODUCT_NOT_FOUND';
        throw error;
    }
    if (product.seller_id !== sellerId) {
        const error = new Error('Unauthorized');
        error.code = 'UNAUTHORIZED';
        throw error;
    }
    return product;
}

// Description updates management
export async function getDescriptionUpdates(productId, sellerId) {
    await verifyProductOwnership(productId, sellerId);
    return await productDescUpdateModel.findByProductId(productId);
}

export async function updateDescriptionUpdate(updateId, sellerId, content) {
    const update = await productDescUpdateModel.findById(updateId);
    if (!update) {
        const error = new Error('Update not found');
        error.code = 'UPDATE_NOT_FOUND';
        throw error;
    }
    
    await verifyProductOwnership(update.product_id, sellerId);
    await productDescUpdateModel.updateContent(updateId, content);
}

export async function deleteDescriptionUpdate(updateId, sellerId) {
    const update = await productDescUpdateModel.findById(updateId);
    if (!update) {
        const error = new Error('Update not found');
        error.code = 'UPDATE_NOT_FOUND';
        throw error;
    }
    
    await verifyProductOwnership(update.product_id, sellerId);
    await productDescUpdateModel.deleteUpdate(updateId);
}