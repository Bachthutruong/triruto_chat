# Hệ thống Authentication với Remember Me

## Tổng quan

Hệ thống authentication đã được cập nhật để hỗ trợ tính năng "Remember Me", cho phép người dùng duy trì đăng nhập lâu dài trên trình duyệt.

## Tính năng chính

### 1. Remember Me cho Admin/Staff
- Checkbox "Ghi nhớ đăng nhập (30 ngày)" trong trang `/login`
- Session được lưu trong `localStorage` thay vì `sessionStorage`
- Tự động gia hạn session khi có hoạt động

### 2. Remember Me cho Khách hàng  
- Checkbox "Ghi nhớ số điện thoại (30 ngày)" trong trang `/enter-phone`
- Khách hàng không cần nhập lại số điện thoại
- Session được duy trì qua các lần đóng/mở browser

### 3. Auto Session Extension
- Session được gia hạn tự động khi người dùng có hoạt động
- Extension diễn ra mỗi phút khi có hoạt động (click, scroll, keypress, etc.)
- Chỉ áp dụng khi Remember Me được bật

## Cách hoạt động

### Storage Strategy
- **Remember Me OFF**: Sử dụng `sessionStorage` (mất khi đóng browser)
- **Remember Me ON**: Sử dụng `localStorage` với expiry time (30 ngày)

### Session Expiry
- Session có thời hạn 30 ngày khi Remember Me được bật
- Được gia hạn tự động khi có hoạt động
- Kiểm tra expiry mỗi lần load app

### Security
- Session data bao gồm expiry timestamp
- Tự động xóa session hết hạn
- Clear toàn bộ data khi logout

## API Functions

### Auth Utilities (`src/lib/utils/auth.ts`)

```typescript
// Lưu session với remember me
saveUserSession(session: UserSession, rememberMe: boolean, expiryDays?: number)

// Lấy session hiện tại
getUserSession(): UserSession | null

// Kiểm tra session hợp lệ
hasValidSession(): boolean

// Kiểm tra remember me active
isRememberMeActive(): boolean

// Xóa toàn bộ session
clearUserSession(): void

// Gia hạn session
extendSession(expiryDays?: number): void
```

### Auth Hook (`src/hooks/use-auth.ts`)

```typescript
const {
  session,           // Session hiện tại
  isLoading,         // Đang load session
  isAuthenticated,   // Đã đăng nhập
  isRememberMe,      // Remember me active
  logout,            // Logout function
  updateSession      // Update session
} = useAuth();
```

## Migration Notes

Tất cả các file đã được cập nhật để sử dụng auth utilities thay vì truy cập trực tiếp `sessionStorage`:

- ✅ Login pages (`/login`, `/enter-phone`)
- ✅ Main app (`/page.tsx`)
- ✅ Admin/Staff layouts
- ✅ Layout components
- ✅ Logout functionality

## User Experience

### Với Remember Me
- Đăng nhập một lần, duy trì 30 ngày
- Không cần nhập lại thông tin
- Session tự động gia hạn khi sử dụng

### Không Remember Me
- Session chỉ tồn tại trong tab hiện tại
- Đóng browser = phải đăng nhập lại
- Behavior như cũ

## Testing

Để test tính năng:

1. **Test Remember Me ON:**
   - Đăng nhập với checkbox checked
   - Đóng browser và mở lại
   - Kiểm tra vẫn đăng nhập

2. **Test Remember Me OFF:**
   - Đăng nhập không check checkbox
   - Đóng browser và mở lại
   - Kiểm tra phải đăng nhập lại

3. **Test Session Expiry:**
   - Set expiry ngắn (test purpose)
   - Kiểm tra auto logout khi hết hạn

4. **Test Auto Extension:**
   - Monitor localStorage với dev tools
   - Verify expiry được update khi có activity 