import db from '../utils/db.js';
import path from 'path';
import fs from 'fs';

/**
 * Creates a new product, physically moves/renames the uploaded images,
 * and inserts image records into the database within a single transaction.
 * Ensures that if any step fails (e.g. file system error or DB error),
 * the entire database operation is rolled back.
 */
export async function createProductWithImages(productData, thumbnailFile, subImageFiles) {
    const returnedID = await db.transaction(async (trx) => {
        // 1. Insert the main product record
        const [insertedProduct] = await trx('products').insert(productData).returning('id');
        const productId = insertedProduct.id || insertedProduct; // Handle different DB dialects 

        const dirPath = path.join('public', 'images', 'products').replace(/\\/g, "/");

        // 2. Move and rename the main thumbnail
        if (thumbnailFile) {
            const mainPath = path.join(dirPath, `p${productId}_thumb.jpg`).replace(/\\/g, "/");
            const oldMainPath = path.join('public', 'uploads', path.basename(thumbnailFile)).replace(/\\/g, "/");
            const savedMainPath = '/' + path.join('images', 'products', `p${productId}_thumb.jpg`).replace(/\\/g, "/");
            
            // Physical file move
            fs.renameSync(oldMainPath, mainPath);
            
            // Update DB with the final permanent path
            await trx('products')
                .where('id', productId)
                .update({ thumbnail: savedMainPath });
        }

        // 3. Move and rename the sub-images and insert their records
        if (subImageFiles && subImageFiles.length > 0) {
            let i = 1;
            let newImgPaths = [];
            for (const imgPath of subImageFiles) {
                const oldPath = path.join('public', 'uploads', path.basename(imgPath)).replace(/\\/g, "/");
                const newPath = path.join(dirPath, `p${productId}_${i}.jpg`).replace(/\\/g, "/");
                const savedPath = '/' + path.join('images', 'products', `p${productId}_${i}.jpg`).replace(/\\/g, "/");
                
                // Physical file move
                fs.renameSync(oldPath, newPath);
                
                newImgPaths.push({
                    product_id: productId,
                    img_link: savedPath
                });
                i++;
            }
            
            // Insert sub images mapping to DB
            if (newImgPaths.length > 0) {
                await trx('product_images').insert(newImgPaths);
            }
        }
        
        return productId;
    });

    return returnedID;
}
