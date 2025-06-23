'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { notificationService } from '@/lib/services/notification.service';

export interface NotificationSettings {
  newCustomer: boolean;
  newMessage: boolean;
  chatReply: boolean;
}

export interface UseNotificationReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  settings: NotificationSettings;
  requestPermission: () => Promise<NotificationPermission>;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
  showTestNotification: () => Promise<void>;
}

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

export function useNotification(): UseNotificationReturn {
  const { socket, isConnected } = useSocket();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    newCustomer: true,
    newMessage: true,
    chatReply: true,
  });

  // Initialize notification support and permission status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    console.log('[useNotification] Initializing...');
    const supported = notificationService.isNotificationSupported();
    const currentPermission = notificationService.getPermissionStatus();
    
    setIsSupported(supported);
    setPermission(currentPermission);
    
    console.log('[useNotification] Status:', { supported, currentPermission });

    // Load saved settings
    try {
      const savedSettings = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
        console.log('[useNotification] Loaded settings:', parsedSettings);
      }
    } catch (error) {
      console.error('Error parsing notification settings:', error);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    const newPermission = await notificationService.requestPermission();
    setPermission(newPermission);
    return newPermission;
  }, []);

  // Update notification settings
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Show test notification
  const showTestNotification = useCallback(async () => {
    if (permission !== 'granted') {
      const newPermission = await requestPermission();
      if (newPermission !== 'granted') {
        alert('Vui lòng cho phép thông báo để sử dụng tính năng này');
        return;
      }
    }

    await notificationService.showNotification({
      type: 'new_message',
      title: 'Thông báo thử nghiệm',
      body: 'Thông báo web đang hoạt động tốt!',
      requireInteraction: false,
    });
  }, [permission, requestPermission]);

  // Socket event listeners for notifications
  useEffect(() => {
    console.log('[useNotification] Setting up socket listeners:', {
      hasSocket: !!socket,
      isConnected,
      permission,
      settings
    });

    if (!socket || !isConnected) {
      console.log('[useNotification] No socket or not connected, skipping setup');
      return;
    }

    // Listen for new customer notifications
    const handleNewCustomer = (data: {
      customerId: string;
      customerName?: string;
      customerPhone: string;
    }) => {
      console.log('[useNotification] Received newCustomerNotification:', data);
      if (permission === 'granted' && settings.newCustomer) {
        console.log('[useNotification] Showing new customer notification');
        notificationService.showNewCustomerNotification(data);
      } else {
        console.log('[useNotification] Skipping notification:', { permission, setting: settings.newCustomer });
      }
    };

    // Listen for new message notifications
    const handleNewMessage = (data: {
      customerId: string;
      customerName?: string;
      messageContent: string;
      conversationId: string;
      sender: string;
    }) => {
      console.log('[useNotification] Received newMessageNotification:', data);
      // Only show notification for customer messages, not staff/AI messages
      if (permission === 'granted' && settings.newMessage && data.sender === 'user') {
        console.log('[useNotification] Showing new message notification');
        notificationService.showNewMessageNotification({
          customerId: data.customerId,
          customerName: data.customerName,
          messageContent: data.messageContent,
          conversationId: data.conversationId,
        });
      } else {
        console.log('[useNotification] Skipping notification:', { permission, setting: settings.newMessage, sender: data.sender });
      }
    };

    // Listen for chat reply notifications
    const handleChatReply = (data: {
      customerId: string;
      customerName?: string;
      replyContent: string;
      conversationId: string;
      staffName?: string;
      sender: string;
    }) => {
      console.log('[useNotification] Received chatReplyNotification:', data);
      // Only show notification for staff replies, not AI or user messages
      if (permission === 'granted' && settings.chatReply && (data.sender === 'staff' || data.sender === 'system')) {
        console.log('[useNotification] Showing chat reply notification');
        notificationService.showChatReplyNotification({
          customerId: data.customerId,
          customerName: data.customerName,
          replyContent: data.replyContent,
          conversationId: data.conversationId,
          staffName: data.staffName,
        });
      } else {
        console.log('[useNotification] Skipping notification:', { permission, setting: settings.chatReply, sender: data.sender });
      }
    };

    // Register socket event listeners
    socket.on('newCustomerNotification', handleNewCustomer);
    socket.on('newMessageNotification', handleNewMessage);
    socket.on('chatReplyNotification', handleChatReply);

    console.log('[useNotification] Socket listeners registered');

    // Cleanup event listeners on unmount
    return () => {
      console.log('[useNotification] Cleaning up socket listeners');
      socket.off('newCustomerNotification', handleNewCustomer);
      socket.off('newMessageNotification', handleNewMessage);
      socket.off('chatReplyNotification', handleChatReply);
    };
  }, [socket, isConnected, permission, settings]);

  return {
    isSupported,
    permission,
    settings,
    requestPermission,
    updateSettings,
    showTestNotification,
  };
}

// Hook for notification settings management only (without socket listeners)
export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>({
    newCustomer: true,
    newMessage: true,
    chatReply: true,
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      } catch (error) {
        console.error('Error parsing notification settings:', error);
      }
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(updatedSettings));
  }, [settings]);

  return {
    settings,
    updateSettings,
  };
} 