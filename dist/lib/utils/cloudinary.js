"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToCloudinary = uploadToCloudinary;
exports.uploadBufferToCloudinary = uploadBufferToCloudinary;
exports.deleteFromCloudinary = deleteFromCloudinary;
exports.extractPublicIdFromUrl = extractPublicIdFromUrl;
exports.getTransformedImageUrl = getTransformedImageUrl;
const cloudinary_1 = require("cloudinary");
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
/**
 * Upload a file to Cloudinary from base64 data URI
 */
async function uploadToCloudinary(dataUri, fileName, folder = 'triruto_chat') {
    try {
        const uploadOptions = {
            folder,
            public_id: `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`,
            resource_type: 'auto',
            quality: 'auto',
            fetch_format: 'auto',
        };
        const result = await cloudinary_1.v2.uploader.upload(dataUri, uploadOptions);
        return {
            public_id: result.public_id,
            url: result.url,
            secure_url: result.secure_url,
            format: result.format,
            resource_type: result.resource_type,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
        };
    }
    catch (error) {
        console.error('Cloudinary upload error:', error);
        throw new Error('Failed to upload image to Cloudinary');
    }
}
/**
 * Upload a file buffer to Cloudinary
 */
async function uploadBufferToCloudinary(buffer, fileName, mimeType, folder = 'triruto_chat') {
    try {
        const base64Data = `data:${mimeType};base64,${buffer.toString('base64')}`;
        return await uploadToCloudinary(base64Data, fileName, folder);
    }
    catch (error) {
        console.error('Cloudinary buffer upload error:', error);
        throw new Error('Failed to upload buffer to Cloudinary');
    }
}
/**
 * Delete an image from Cloudinary
 */
async function deleteFromCloudinary(publicId) {
    try {
        await cloudinary_1.v2.uploader.destroy(publicId);
    }
    catch (error) {
        console.error('Cloudinary delete error:', error);
        // Don't throw error for delete operations to avoid breaking the flow
    }
}
/**
 * Extract public_id from Cloudinary URL
 */
function extractPublicIdFromUrl(url) {
    try {
        const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
        return matches ? matches[1] : null;
    }
    catch (error) {
        console.error('Error extracting public_id:', error);
        return null;
    }
}
/**
 * Generate transformation URL for images
 */
function getTransformedImageUrl(url, transformations = {}) {
    try {
        const publicId = extractPublicIdFromUrl(url);
        if (!publicId)
            return url;
        const transformParams = [];
        if (transformations.width)
            transformParams.push(`w_${transformations.width}`);
        if (transformations.height)
            transformParams.push(`h_${transformations.height}`);
        if (transformations.quality)
            transformParams.push(`q_${transformations.quality}`);
        if (transformations.format)
            transformParams.push(`f_${transformations.format}`);
        if (transformations.crop)
            transformParams.push(`c_${transformations.crop}`);
        const transformString = transformParams.length > 0 ? `${transformParams.join(',')}` : '';
        return cloudinary_1.v2.url(publicId, {
            transformation: transformString,
            secure: true,
        });
    }
    catch (error) {
        console.error('Error generating transformed URL:', error);
        return url;
    }
}
exports.default = cloudinary_1.v2;
