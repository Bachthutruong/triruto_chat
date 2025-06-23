# Cloudinary Integration Guide

## Tổng quan

Hệ thống đã được cập nhật để sử dụng Cloudinary để lưu trữ và hiển thị ảnh thay vì data URI. Điều này mang lại các lợi ích:

- **Hiệu suất tốt hơn**: Load ảnh nhanh hơn với CDN của Cloudinary
- **Tối ưu hóa**: Tự động tối ưu chất lượng và format ảnh
- **Tiết kiệm băng thông**: Không lưu data URI lớn trong database
- **Khả năng mở rộng**: Không giới hạn kích thước database do ảnh

## Cấu hình

### 1. Tạo tài khoản Cloudinary

1. Truy cập https://cloudinary.com và đăng ký tài khoản
2. Sau khi đăng ký, vào Dashboard để lấy thông tin cấu hình

### 2. Cấu hình Environment Variables

Thêm các biến môi trường sau vào file `.env.local`:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Lưu ý**: Thay thế `your_cloud_name`, `your_api_key`, và `your_api_secret` bằng thông tin thực từ Dashboard Cloudinary của bạn.

### 3. Cấu hình Cloudinary Dashboard

1. **Upload presets**: Tạo unsigned upload preset nếu cần
2. **Transformations**: Cấu hình các transformation mặc định
3. **Media library**: Tổ chức thư mục lưu trữ

## Cách hoạt động

### Upload Flow

1. **User chọn file** → Validate file (size, type)
2. **Preview ngay lập tức** → Hiển thị preview từ data URI
3. **Upload background** → Upload lên Cloudinary
4. **Update URL** → Thay thế data URI bằng Cloudinary URL
5. **Lưu message** → Lưu Cloudinary URL vào database

### Storage Structure

```
triruto_chat/
├── messages/     # Ảnh từ tin nhắn chat
├── notes/        # Ảnh từ ghi chú
└── general/      # Ảnh khác
```

### Backward Compatibility

Hệ thống hỗ trợ cả:
- **Cloudinary URLs**: Format mới (ưu tiên)
- **Data URIs**: Format cũ (tương thích ngược)

### Message Format

**Format mới (Cloudinary)**:
```
https://res.cloudinary.com/your-cloud/image/upload/v1234567890/file.jpg#filename=encoded_name
Text content (optional)
```

**Format cũ (Data URI)**:
```
data:image/jpeg;base64,/9j/4AAQ...#filename=encoded_name
Text content (optional)
```

## Features

### 1. Automatic Upload
- File được upload tự động khi chọn
- Hiển thị progress "đang tải lên..."
- Fallback về data URI nếu upload thất bại

### 2. Image Optimization
- Tự động tối ưu chất lượng (`quality: 'auto'`)
- Tự động chọn format tốt nhất (`fetch_format: 'auto'`)
- Transformations on-demand

### 3. Media Library
- Staff có thể chọn ảnh từ thư viện đã upload
- Hỗ trợ cả Cloudinary URLs và data URIs
- Preview và download

### 4. Notes System
- Upload ảnh cho ghi chú khách hàng
- Tự động delete ảnh cũ khi cập nhật
- Lưu cả URL và public_id để quản lý

## API Endpoints

### POST /api/upload
Upload file trực tiếp:
```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('uploadType', 'chat'); // 'chat' | 'note' | 'general'

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});
```

### PUT /api/upload
Upload từ data URI (backward compatibility):
```typescript
const response = await fetch('/api/upload', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dataUri: 'data:image/jpeg;base64,...',
    fileName: 'image.jpg',
    uploadType: 'chat'
  }),
});
```

## Utility Functions

### Upload Utilities
```typescript
import { uploadFile, uploadDataUri, validateFile } from '@/lib/utils/upload';

// Upload file
const result = await uploadFile(file, 'chat');

// Upload data URI
const result = await uploadDataUri(dataUri, fileName, 'chat');

// Validate file
const validation = validateFile(file, 5); // 5MB limit
```

### Content Processing
```typescript
import { extractImageFromContent, isCloudinaryUrl } from '@/lib/utils/upload';

// Extract media from message content
const { imageUrl, fileName, textContent } = extractImageFromContent(content);

// Check URL type
const isCloudinary = isCloudinaryUrl(url);
```

## Migration

### Existing Data
- Data URIs hiện tại vẫn hoạt động bình thường
- Không cần migrate dữ liệu cũ
- Upload mới sẽ sử dụng Cloudinary

### Progressive Enhancement
- Hệ thống tự động detect và xử lý cả 2 format
- User experience liền mạch
- Performance tăng dần khi có nhiều Cloudinary URLs

## Troubleshooting

### Upload Failures
1. **Check environment variables**: Đảm bảo Cloudinary config đúng
2. **Check file size**: Maximum 5MB per file
3. **Check file type**: Chỉ hỗ trợ các format được phép
4. **Network issues**: Fallback về data URI nếu cần

### Display Issues
1. **CORS errors**: Cloudinary thường không có vấn đề CORS
2. **Loading errors**: Fallback về placeholder hoặc data URI
3. **Format issues**: Sử dụng auto format transformation

### Performance
1. **Lazy loading**: Next.js Image component tự động lazy load
2. **Transformations**: Sử dụng responsive images
3. **Caching**: Cloudinary CDN cache tự động

## Best Practices

### File Management
- Sử dụng descriptive filenames
- Organize bằng folders (uploadType)
- Clean up unused files định kỳ

### Performance
- Sử dụng appropriate image sizes
- Enable progressive JPEG
- Use WebP when possible (auto format)

### Security
- Validate file types server-side
- Limit file sizes
- Use signed URLs cho sensitive content

### Monitoring
- Monitor Cloudinary usage quota
- Track upload success rates
- Watch for failed uploads

## Future Enhancements

### Planned Features
- [ ] Bulk upload support
- [ ] Image editing capabilities
- [ ] Advanced transformations
- [ ] Video support
- [ ] Analytics integration

### Optimization Opportunities
- [ ] Preload critical images
- [ ] Implement image sprites
- [ ] Add blur placeholders
- [ ] Optimize thumbnail generation 