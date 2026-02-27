import fs from 'fs';
import path from 'path';

const DIR_PATH = path.join('public', 'images', 'products').replace(/\\/g, "/");
const UPLOADS_PATH = path.join('public', 'uploads');

export const moveAndRenameThumbnail = (productId, originalThumbnailName) => {
    const mainPath = path.join(DIR_PATH, `p${productId}_thumb.jpg`).replace(/\\/g, "/");
    const oldMainPath = path.join(UPLOADS_PATH, path.basename(originalThumbnailName)).replace(/\\/g, "/");
    const savedMainPath = '/' + path.join('images', 'products', `p${productId}_thumb.jpg`).replace(/\\/g, "/");
    
    fs.renameSync(oldMainPath, mainPath);
    return savedMainPath;
};

export const moveAndRenameSubImages = (productId, imgsListString) => {
    const imgs = JSON.parse(imgsListString);
    const newImgPaths = [];
    let i = 1;

    for (const imgPath of imgs) {
        const oldPath = path.join(UPLOADS_PATH, path.basename(imgPath)).replace(/\\/g, "/");
        const newPath = path.join(DIR_PATH, `p${productId}_${i}.jpg`).replace(/\\/g, "/");
        const savedPath = '/' + path.join('images', 'products', `p${productId}_${i}.jpg`).replace(/\\/g, "/");
        
        fs.renameSync(oldPath, newPath);
        newImgPaths.push({
            product_id: productId,
            img_link: savedPath
        });
        i++;
    }
    return newImgPaths;
};