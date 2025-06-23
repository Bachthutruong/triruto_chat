import type { UserSession } from '@/lib/types';

const SESSION_STORAGE_KEY = 'aetherChatUserSession';
const PREFETCH_STORAGE_KEY = 'aetherChatPrefetchedData';
const REMEMBER_ME_KEY = 'aetherChatRememberMe';

export interface AuthStorageData {
  session: UserSession;
  expiresAt?: number;
  rememberMe: boolean;
}

/**
 * Lưu session với tùy chọn remember me
 */
export function saveUserSession(session: UserSession, rememberMe: boolean = false, expiryDays: number = 30): void {
  const data: AuthStorageData = {
    session,
    rememberMe,
    expiresAt: rememberMe ? Date.now() + (expiryDays * 24 * 60 * 60 * 1000) : undefined
  };

  if (rememberMe) {
    // Lưu vào localStorage nếu remember me
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(REMEMBER_ME_KEY, 'true');
  } else {
    // Lưu vào sessionStorage nếu không remember me
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.removeItem(REMEMBER_ME_KEY);
  }
}

/**
 * Lấy session từ storage (ưu tiên localStorage trước, sau đó sessionStorage)
 */
export function getUserSession(): UserSession | null {
  try {
    // Kiểm tra localStorage trước (remember me)
    const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    if (rememberMe) {
      const storedData = localStorage.getItem(SESSION_STORAGE_KEY);
      if (storedData) {
        const data: AuthStorageData = JSON.parse(storedData);
        
        // Kiểm tra expiry
        if (data.expiresAt && Date.now() > data.expiresAt) {
          clearUserSession();
          return null;
        }
        
        return data.session;
      }
    }

    // Kiểm tra sessionStorage
    const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionData) {
      return JSON.parse(sessionData);
    }

    return null;
  } catch (error) {
    console.error('Error getting user session:', error);
    clearUserSession();
    return null;
  }
}

/**
 * Kiểm tra xem có session hợp lệ không
 */
export function hasValidSession(): boolean {
  return getUserSession() !== null;
}

/**
 * Kiểm tra xem có đang sử dụng remember me không
 */
export function isRememberMeActive(): boolean {
  return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
}

/**
 * Xóa toàn bộ session và dữ liệu liên quan
 */
export function clearUserSession(): void {
  // Xóa từ localStorage
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(REMEMBER_ME_KEY);
  
  // Xóa từ sessionStorage
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(PREFETCH_STORAGE_KEY);
}

/**
 * Cập nhật session hiện tại
 */
export function updateUserSession(session: UserSession): void {
  const rememberMe = isRememberMeActive();
  if (rememberMe) {
    const storedData = localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedData) {
      try {
        const data: AuthStorageData = JSON.parse(storedData);
        data.session = session;
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error('Error updating localStorage session:', error);
        saveUserSession(session, rememberMe);
      }
    } else {
      saveUserSession(session, rememberMe);
    }
  } else {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }
}

/**
 * Lưu prefetched data
 */
export function savePrefetchedData(data: any): void {
  sessionStorage.setItem(PREFETCH_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Lấy prefetched data
 */
export function getPrefetchedData(): any | null {
  try {
    const data = sessionStorage.getItem(PREFETCH_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting prefetched data:', error);
    return null;
  }
}

/**
 * Xóa prefetched data
 */
export function clearPrefetchedData(): void {
  sessionStorage.removeItem(PREFETCH_STORAGE_KEY);
}

/**
 * Extend session nếu đang sử dụng remember me
 */
export function extendSession(expiryDays: number = 30): void {
  const session = getUserSession();
  if (session && isRememberMeActive()) {
    saveUserSession(session, true, expiryDays);
  }
} 