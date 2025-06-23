import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary, uploadBufferToCloudinary } from '@/lib/utils/cloudinary';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadType = formData.get('uploadType') as string || 'chat'; // 'chat', 'note', 'general'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine folder based on upload type
    const folder = `triruto_chat/${uploadType}`;

    // Upload to Cloudinary
    const result = await uploadBufferToCloudinary(
      buffer,
      file.name,
      file.type,
      folder
    );

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    });

  } catch (error: any) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

// Handle data URI uploads (for backward compatibility)
export async function PUT(request: NextRequest) {
  try {
    const { dataUri, fileName, uploadType = 'chat' } = await request.json();

    if (!dataUri || !fileName) {
      return NextResponse.json(
        { error: 'Data URI and file name are required' },
        { status: 400 }
      );
    }

    // Determine folder based on upload type
    const folder = `triruto_chat/${uploadType}`;

    // Upload to Cloudinary
    const result = await uploadToCloudinary(dataUri, fileName, folder);

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    });

  } catch (error: any) {
    console.error('Data URI upload API error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
} 