# Tính năng Thư viện Media

## Tổng quan
Chức năng thư viện media cho phép admin và staff chọn và gửi lại các file media (ảnh, video, tài liệu) đã được gửi trước đó, giúp tiết kiệm thời gian và tăng hiệu quả công việc.

## Tính năng chính

### 1. Icon Thư viện Media
- **Vị trí**: Trong input chat của admin/staff, bên cạnh icon đính kèm file
- **Icon**: Images (📷) 
- **Hiển thị**: Chỉ hiển thị cho admin và staff, không hiển thị cho customer

### 2. Modal Thư viện Media
- **Giao diện**: Grid layout hiển thị thumbnail của media
- **Tìm kiếm**: Có thể tìm kiếm theo tên file
- **Sắp xếp**: Các file được sắp xếp theo thời gian gửi (mới nhất trước)
- **Giới hạn**: Hiển thị 100 file media gần nhất để tránh ảnh hưởng hiệu suất

### 3. Chọn Media
- **Cách chọn**: Click vào media item để chọn
- **Preview**: Click để xem trước media trước khi chọn
- **Kết quả**: Media được chọn sẽ xuất hiện trong staged file của input chat

## Cách sử dụng

1. **Mở thư viện**: Click vào icon Images (📷) trong input chat
2. **Duyệt media**: Xem các media đã gửi trước đó trong giao diện grid
3. **Tìm kiếm**: Sử dụng ô tìm kiếm để lọc theo tên file
4. **Chọn media**: Click vào media muốn gửi lại
5. **Gửi**: Media sẽ được staged, có thể thêm text và gửi như bình thường

## Loại file được hỗ trợ
- **Ảnh**: JPEG, PNG, GIF, WebP, SVG
- **Tài liệu**: PDF, DOC, DOCX, XLS, XLSX, TXT, RTF
- **File nén**: ZIP, RAR
- **Khác**: Các file application/octet-stream

## Lưu ý kỹ thuật
- Media được lưu trữ dưới dạng Data URI trong database
- Chỉ lấy media từ messages của admin/staff (có staffId)
- Hiệu suất được tối ưu bằng cách giới hạn 100 file gần nhất
- Hỗ trợ cả ảnh và file text với preview phù hợp

## Files liên quan
- `src/app/actions.ts`: Function `getStaffMediaMessages()`
- `src/components/chat/MediaLibraryModal.tsx`: Component modal thư viện
- `src/components/chat/MessageInputForm.tsx`: Input chat với icon media library 