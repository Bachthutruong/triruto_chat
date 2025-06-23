import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryMediaItem {
  public_id: string;
  secure_url: string;
  format: string;
  resource_type: string;
  bytes: number;
  width?: number;
  height?: number;
  created_at: string;
  folder?: string;
  filename?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('type') || 'image'; // 'image' or 'raw' (for other files)
    const maxResults = parseInt(searchParams.get('max_results') || '100');
    const nextCursor = searchParams.get('next_cursor');

    // Search for media in triruto_chat folder
    const searchOptions: any = {
      type: 'upload',
      prefix: 'triruto_chat/',
      max_results: maxResults,
      resource_type: resourceType as 'image' | 'raw',
    };

    if (nextCursor) {
      searchOptions.next_cursor = nextCursor;
    }

    const result = await cloudinary.api.resources(searchOptions);

    const mediaItems: CloudinaryMediaItem[] = result.resources.map((resource: any) => ({
      public_id: resource.public_id,
      secure_url: resource.secure_url,
      format: resource.format,
      resource_type: resource.resource_type,
      bytes: resource.bytes,
      width: resource.width,
      height: resource.height,
      created_at: resource.created_at,
      folder: resource.folder,
      filename: resource.filename || extractFilenameFromPublicId(resource.public_id),
    }));

    return NextResponse.json({
      resources: mediaItems,
      next_cursor: result.next_cursor,
      total_count: result.total_count,
    });

  } catch (error: any) {
    console.error('Error fetching media from Cloudinary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch media' },
      { status: 500 }
    );
  }
}

// Get specific media by resource type
export async function POST(request: NextRequest) {
  try {
    const { folders = ['triruto_chat/messages', 'triruto_chat/notes', 'triruto_chat/general'] } = await request.json();
    
    const allMedia: CloudinaryMediaItem[] = [];

    // Fetch from each folder
    for (const folder of folders) {
      try {
        // Fetch images
        const imageResult = await cloudinary.api.resources({
          type: 'upload',
          prefix: folder,
          max_results: 50,
          resource_type: 'image',
        });

        // Fetch raw files (documents, etc.)
        const rawResult = await cloudinary.api.resources({
          type: 'upload',
          prefix: folder,
          max_results: 50,
          resource_type: 'raw',
        });

        // Combine results
        const folderMedia = [...imageResult.resources, ...rawResult.resources].map((resource: any) => ({
          public_id: resource.public_id,
          secure_url: resource.secure_url,
          format: resource.format,
          resource_type: resource.resource_type,
          bytes: resource.bytes,
          width: resource.width,
          height: resource.height,
          created_at: resource.created_at,
          folder: resource.folder,
          filename: resource.filename || extractFilenameFromPublicId(resource.public_id),
        }));

        allMedia.push(...folderMedia);
      } catch (folderError) {
        console.warn(`Error fetching from folder ${folder}:`, folderError);
        // Continue with other folders
      }
    }

    // Sort all media by created_at desc
    allMedia.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({
      resources: allMedia,
      total_count: allMedia.length,
    });

  } catch (error: any) {
    console.error('Error fetching all media:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch all media' },
      { status: 500 }
    );
  }
}

function extractFilenameFromPublicId(publicId: string): string {
  // Extract filename from public_id like "triruto_chat/messages/1234567890_image_name"
  const parts = publicId.split('/');
  const lastPart = parts[parts.length - 1];
  
  // Remove timestamp prefix if exists
  const withoutTimestamp = lastPart.replace(/^\d+_/, '');
  
  // Replace underscores with spaces and clean up
  return withoutTimestamp.replace(/_/g, ' ').trim() || 'Untitled';
} 