import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  url: string;
  secure_url: string;
  format: string;
  resource_type: string;
  bytes: number;
  width?: number;
  height?: number;
}

/**
 * Upload a file to Cloudinary from base64 data URI
 */
export async function uploadToCloudinary(
  dataUri: string,
  fileName: string,
  folder: string = 'triruto_chat'
): Promise<CloudinaryUploadResult> {
  try {
    const uploadOptions = {
      folder,
      public_id: `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`,
      resource_type: 'auto' as const,
      quality: 'auto',
      fetch_format: 'auto',
    };

    const result = await cloudinary.uploader.upload(dataUri, uploadOptions);
    
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
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
}

/**
 * Upload a file buffer to Cloudinary
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string = 'triruto_chat'
): Promise<CloudinaryUploadResult> {
  try {
    const base64Data = `data:${mimeType};base64,${buffer.toString('base64')}`;
    return await uploadToCloudinary(base64Data, fileName, folder);
  } catch (error) {
    console.error('Cloudinary buffer upload error:', error);
    throw new Error('Failed to upload buffer to Cloudinary');
  }
}

/**
 * Delete an image from Cloudinary
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    // Don't throw error for delete operations to avoid breaking the flow
  }
}

/**
 * Extract public_id from Cloudinary URL
 */
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    return matches ? matches[1] : null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
}

/**
 * Generate transformation URL for images
 */
export function getTransformedImageUrl(
  url: string,
  transformations: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
    crop?: string;
  } = {}
): string {
  try {
    const publicId = extractPublicIdFromUrl(url);
    if (!publicId) return url;

    const transformParams = [];
    if (transformations.width) transformParams.push(`w_${transformations.width}`);
    if (transformations.height) transformParams.push(`h_${transformations.height}`);
    if (transformations.quality) transformParams.push(`q_${transformations.quality}`);
    if (transformations.format) transformParams.push(`f_${transformations.format}`);
    if (transformations.crop) transformParams.push(`c_${transformations.crop}`);

    const transformString = transformParams.length > 0 ? `${transformParams.join(',')}` : '';
    
    return cloudinary.url(publicId, {
      transformation: transformString,
      secure: true,
    });
  } catch (error) {
    console.error('Error generating transformed URL:', error);
    return url;
  }
}

export default cloudinary; 