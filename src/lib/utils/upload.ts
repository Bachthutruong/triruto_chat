export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

/**
 * Upload a file using FormData (from File object)
 */
export async function uploadFile(
  file: File,
  uploadType: 'chat' | 'note' | 'general' = 'chat'
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('uploadType', uploadType);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  return await response.json();
}

/**
 * Upload from data URI (for backward compatibility)
 */
export async function uploadDataUri(
  dataUri: string,
  fileName: string,
  uploadType: 'chat' | 'note' | 'general' = 'chat'
): Promise<UploadResult> {
  const response = await fetch('/api/upload', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dataUri,
      fileName,
      uploadType,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  return await response.json();
}

/**
 * Convert File to data URI (for preview purposes)
 */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validate image file
 */
export function validateImageFile(
  file: File,
  maxSizeMB: number = 5
): { isValid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { isValid: false, error: 'Chỉ chấp nhận tệp hình ảnh.' };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `Kích thước ảnh không được vượt quá ${maxSizeMB}MB.`,
    };
  }

  return { isValid: true };
}

/**
 * Validate any file
 */
export function validateFile(
  file: File,
  maxSizeMB: number = 5,
  allowedTypes?: string[]
): { isValid: boolean; error?: string } {
  // Check file type if specified
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Loại tệp không được hỗ trợ. Chỉ chấp nhận: ${allowedTypes.join(', ')}`,
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `Kích thước tệp không được vượt quá ${maxSizeMB}MB.`,
    };
  }

  return { isValid: true };
}

/**
 * Extract filename from URL
 */
export function extractFilenameFromUrl(url: string, fallback: string = 'file'): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || fallback;
    return filename.split('.')[0]; // Remove extension for display
  } catch {
    return fallback;
  }
}

/**
 * Check if URL is a Cloudinary URL
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
}

/**
 * Check if content is a legacy data URI format
 */
export function isDataUri(content: string): boolean {
  return content.startsWith('data:');
}

/**
 * Extract image URL from message content (handles both old and new formats)
 */
export function extractImageFromContent(content: string): {
  imageUrl?: string;
  fileName?: string;
  textContent?: string;
} {
  // New format: cloudinary_url#filename=encoded_name<newline>text_content
  const cloudinaryPattern = /^(https:\/\/res\.cloudinary\.com\/[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
  const cloudinaryMatch = content.match(cloudinaryPattern);
  
  if (cloudinaryMatch) {
    let fileName = "attached_file";
    try {
      fileName = decodeURIComponent(cloudinaryMatch[2]);
    } catch (e) {
      console.warn("Cannot decode filename from URL", e);
    }
    
    return {
      imageUrl: cloudinaryMatch[1],
      fileName,
      textContent: cloudinaryMatch[3]?.trim()
    };
  }

  // Legacy format: data:type;base64,data#filename=encoded_name<newline>text_content
  const dataUriPattern = /^(data:[^;]+;base64,[^#]+)#filename=([^#\s]+)(?:\n([\s\S]*))?$/;
  const dataUriMatch = content.match(dataUriPattern);
  
  if (dataUriMatch) {
    let fileName = "attached_file";
    try {
      fileName = decodeURIComponent(dataUriMatch[2]);
    } catch (e) {
      console.warn("Cannot decode filename from URI", e);
    }
    
    return {
      imageUrl: dataUriMatch[1], // Keep data URI for backward compatibility
      fileName,
      textContent: dataUriMatch[3]?.trim()
    };
  }

  return {};
} 