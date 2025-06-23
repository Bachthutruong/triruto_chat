'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import { useNotificationSettings } from '@/hooks/use-notification';
import { notificationService } from '@/lib/services/notification.service';

export function NotificationSettings() {
  const { settings, updateSettings } = useNotificationSettings();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  useEffect(() => {
    setIsSupported(notificationService.isNotificationSupported());
    setPermission(notificationService.getPermissionStatus());
  }, []);

  const handleRequestPermission = async () => {
    const newPermission = await notificationService.requestPermission();
    setPermission(newPermission);
  };

  const handleTestNotification = async () => {
    if (permission !== 'granted') {
      await handleRequestPermission();
      return;
    }

    setIsTestingNotification(true);
    try {
      await notificationService.showNotification({
        type: 'new_message',
        title: '🔔 Thông báo thử nghiệm',
        body: 'Hệ thống thông báo đang hoạt động tốt!',
        requireInteraction: false,
      });
    } catch (error) {
      console.error('Error showing test notification:', error);
    } finally {
      setTimeout(() => setIsTestingNotification(false), 1000);
    }
  };

  const getPermissionStatus = () => {
    switch (permission) {
      case 'granted':
        return { color: 'text-green-600', text: 'Đã cho phép', icon: Bell };
      case 'denied':
        return { color: 'text-red-600', text: 'Đã từ chối', icon: BellOff };
      default:
        return { color: 'text-yellow-600', text: 'Chưa quyết định', icon: Volume2 };
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VolumeX className="h-5 w-5" />
            Thông báo Web
          </CardTitle>
          <CardDescription>
            Trình duyệt của bạn không hỗ trợ thông báo web
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Vui lòng sử dụng trình duyệt hiện đại như Chrome, Firefox, hoặc Safari để nhận thông báo.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const statusInfo = getPermissionStatus();
  const StatusIcon = statusInfo.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StatusIcon className="h-5 w-5" />
          Cài đặt thông báo Web
        </CardTitle>
        <CardDescription>
          Quản lý thông báo cho khách mới, tin nhắn mới và phản hồi chat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <div className="font-medium">Trạng thái quyền thông báo</div>
            <div className={`text-sm ${statusInfo.color}`}>
              {statusInfo.text}
            </div>
          </div>
          {permission !== 'granted' && (
            <Button onClick={handleRequestPermission} variant="outline">
              Cho phép thông báo
            </Button>
          )}
          {permission === 'granted' && (
            <Button 
              onClick={handleTestNotification} 
              variant="outline"
              disabled={isTestingNotification}
            >
              {isTestingNotification ? 'Đang gửi...' : 'Thử nghiệm'}
            </Button>
          )}
        </div>

        {permission === 'denied' && (
          <Alert>
            <AlertDescription>
              Bạn đã từ chối quyền thông báo. Để bật lại, vui lòng:
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Nhấp vào biểu tượng khóa/thông tin bên trái thanh địa chỉ</li>
                <li>Chọn "Cho phép" cho mục Thông báo</li>
                <li>Tải lại trang</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}

        {/* Notification Type Settings */}
        <div className="space-y-4">
          <h4 className="font-medium">Loại thông báo</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="new-customer" className="text-base">
                  Khách hàng mới
                </Label>
                <div className="text-sm text-muted-foreground">
                  Thông báo khi có khách hàng mới liên hệ lần đầu
                </div>
              </div>
              <Switch
                id="new-customer"
                checked={settings.newCustomer}
                onCheckedChange={(checked) => updateSettings({ newCustomer: checked })}
                disabled={permission !== 'granted'}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="new-message" className="text-base">
                  Tin nhắn mới
                </Label>
                <div className="text-sm text-muted-foreground">
                  Thông báo khi khách hàng gửi tin nhắn mới
                </div>
              </div>
              <Switch
                id="new-message"
                checked={settings.newMessage}
                onCheckedChange={(checked) => updateSettings({ newMessage: checked })}
                disabled={permission !== 'granted'}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="chat-reply" className="text-base">
                  Phản hồi chat
                </Label>
                <div className="text-sm text-muted-foreground">
                  Thông báo khi nhân viên phản hồi khách hàng
                </div>
              </div>
              <Switch
                id="chat-reply"
                checked={settings.chatReply}
                onCheckedChange={(checked) => updateSettings({ chatReply: checked })}
                disabled={permission !== 'granted'}
              />
            </div>
          </div>
        </div>

        {permission === 'granted' && (
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertDescription>
              Thông báo đã được kích hoạt! Bạn sẽ nhận được thông báo ngay cả khi không mở trang web.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 