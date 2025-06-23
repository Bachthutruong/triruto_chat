export interface NotificationData {
  type: 'new_customer' | 'new_message' | 'chat_reply';
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private isSupported: boolean = false;
  private permission: NotificationPermission = 'default';

  constructor() {
    if (typeof window !== 'undefined') {
      this.isSupported = 'Notification' in window;
      if (this.isSupported) {
        this.permission = Notification.permission;
      }
    }
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermission(): Promise<NotificationPermission> {
    console.log('[NotificationService] Requesting permission...');
    if (!this.isSupported) {
      console.warn('[NotificationService] Web Notifications are not supported in this browser');
      return 'denied';
    }

    if (this.permission === 'default') {
      console.log('[NotificationService] Current permission is default, requesting...');
      this.permission = await Notification.requestPermission();
      console.log('[NotificationService] Permission result:', this.permission);
    } else {
      console.log('[NotificationService] Permission already set:', this.permission);
    }

    return this.permission;
  }

  isPermissionGranted(): boolean {
    return this.permission === 'granted';
  }

  async showNotification(data: NotificationData): Promise<Notification | null> {
    console.log('[NotificationService] Attempting to show notification:', data);
    
    if (!this.isSupported) {
      console.warn('[NotificationService] Notifications not supported');
      return null;
    }
    
    // Check permission again in real-time
    this.permission = Notification.permission;
    console.log('[NotificationService] Current permission:', this.permission);
    
    if (!this.isPermissionGranted()) {
      console.warn('[NotificationService] Permission not granted:', this.permission);
      return null;
    }

    // Check if document is focused
    const isDocumentHidden = document.hidden;
    const isDocumentFocused = document.hasFocus();
    console.log('[NotificationService] Document state:', { 
      hidden: isDocumentHidden, 
      focused: isDocumentFocused,
      visibilityState: document.visibilityState 
    });

    const options: NotificationOptions = {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag || data.type,
      data: data.data,
      requireInteraction: data.requireInteraction || false,
      silent: false,
    };

    try {
      console.log('[NotificationService] Creating notification with options:', options);
      const notification = new Notification(data.title, options);
      console.log('[NotificationService] Notification object created:', notification);
      
      // Add all event listeners for debugging
      notification.onshow = () => {
        console.log('[NotificationService] ✅ Notification shown successfully!');
      };
      
      notification.onerror = (error) => {
        console.error('[NotificationService] ❌ Notification error:', error);
      };
      
      notification.onclose = () => {
        console.log('[NotificationService] Notification closed');
      };

      // Auto close after 10 seconds if not requiring interaction
      if (!data.requireInteraction) {
        setTimeout(() => {
          try {
            notification.close();
            console.log('[NotificationService] Auto-closed notification after 10s');
          } catch (e) {
            console.log('[NotificationService] Error auto-closing:', e);
          }
        }, 10000);
      }

      // Handle notification click
      notification.onclick = (event) => {
        console.log('[NotificationService] Notification clicked');
        event.preventDefault();
        
        // Bring window to front
        if (window.focus) {
          window.focus();
        }
        
        // Try to bring tab to front
        if (window.parent && window.parent.focus) {
          window.parent.focus();
        }
        
        // Handle different notification types
        switch (data.type) {
          case 'new_customer':
            if (data.data?.customerId) {
              this.navigateToCustomer(data.data.customerId);
            }
            break;
          case 'new_message':
          case 'chat_reply':
            if (data.data?.customerId) {
              this.navigateToChat(data.data.customerId);
            }
            break;
        }
        
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('[NotificationService] Error creating notification:', error);
      return null;
    }
  }

  async showNewCustomerNotification(customerData: {
    customerId: string;
    customerName?: string;
    customerPhone: string;
  }): Promise<Notification | null> {
    const title = '🆕 Khách hàng mới';
    const body = `${customerData.customerName || 'Khách hàng'} (${customerData.customerPhone}) vừa liên hệ`;

    return this.showNotification({
      type: 'new_customer',
      title,
      body,
      tag: `new_customer_${customerData.customerId}`,
      data: customerData,
      requireInteraction: true,
      // Don't set icon to avoid potential issues
    });
  }

  async showNewMessageNotification(messageData: {
    customerId: string;
    customerName?: string;
    messageContent: string;
    conversationId: string;
  }): Promise<Notification | null> {
    const title = '💬 Tin nhắn mới';
    const customerName = messageData.customerName || 'Khách hàng';
    const body = `${customerName}: ${this.truncateMessage(messageData.messageContent)}`;

    return this.showNotification({
      type: 'new_message',
      title,
      body,
      tag: `new_message_${messageData.conversationId}`,
      data: messageData,
      requireInteraction: false,
      // Don't set icon to avoid potential issues
    });
  }

  async showChatReplyNotification(replyData: {
    customerId: string;
    customerName?: string;
    replyContent: string;
    conversationId: string;
    staffName?: string;
  }): Promise<Notification | null> {
    const title = '💬 Phản hồi chat';
    const customerName = replyData.customerName || 'Khách hàng';
    const staffName = replyData.staffName || 'Nhân viên';
    const body = `${staffName} đã phản hồi ${customerName}: ${this.truncateMessage(replyData.replyContent)}`;

    return this.showNotification({
      type: 'chat_reply',
      title,
      body,
      tag: `chat_reply_${replyData.conversationId}`,
      data: replyData,
      requireInteraction: false,
      // Don't set icon to avoid potential issues
    });
  }

  private truncateMessage(message: string, maxLength: number = 50): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }

  private navigateToCustomer(customerId: string): void {
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('/admin')) {
      window.location.href = `/admin/customers?customer=${customerId}`;
    } else if (currentPath.includes('/staff')) {
      window.location.href = `/staff/customers?customer=${customerId}`;
    }
  }

  private navigateToChat(customerId: string): void {
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('/admin')) {
      window.location.href = `/admin/chat/${customerId}`;
    } else if (currentPath.includes('/staff')) {
      window.location.href = `/staff/chat/${customerId}`;
    }
  }

  // Clear notifications by tag
  clearNotificationsByTag(tag: string): void {
    // Note: This is a limitation of the Web Notifications API
    // We can't programmatically clear notifications that are already shown
    // This method is here for potential future use or browser-specific implementations
    console.log(`Clearing notifications with tag: ${tag}`);
  }

  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  // Check if notifications are supported
  isNotificationSupported(): boolean {
    return this.isSupported;
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance(); 