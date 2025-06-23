'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  BellOff, 
  Wifi, 
  WifiOff, 
  Bug, 
  CheckCircle, 
  XCircle, 
  AlertCircle 
} from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { useNotification } from '@/hooks/use-notification';
import { notificationService } from '@/lib/services/notification.service';

export function NotificationDebug() {
  const { socket, isConnected } = useSocket();
  const { isSupported, permission, settings } = useNotification();
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setDebugLog(prev => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev.slice(0, 9)]);
  };

  const checkSystemInfo = () => {
    addLog('=== System Information ===');
    addLog(`User Agent: ${navigator.userAgent}`);
    addLog(`Platform: ${navigator.platform}`);
    addLog(`Document hidden: ${document.hidden}`);
    addLog(`Document focused: ${document.hasFocus()}`);
    addLog(`Visibility state: ${document.visibilityState}`);
    addLog(`Window location: ${window.location.href}`);
    addLog(`Notification permission: ${Notification.permission}`);
    
    // Check if we're in a secure context
    if ('isSecureContext' in window) {
      addLog(`Secure context: ${window.isSecureContext}`);
    }
    
    // Check if we're in an iframe
    addLog(`In iframe: ${window !== window.top}`);

    // Check macOS specific things
    if (navigator.platform.includes('Mac')) {
      addLog('=== macOS Specific Checks ===');
      addLog('💡 Possible issues on macOS:');
      addLog('- Do Not Disturb mode enabled');
      addLog('- Focus/Concentration mode active');
      addLog('- Chrome notifications disabled in System Preferences');
      addLog('- Notification Center turned off');
      addLog('💡 Solutions to try:');
      addLog('1. Check System Preferences > Notifications > Chrome');
      addLog('2. Disable Do Not Disturb');
      addLog('3. Switch to a different tab and test');
      addLog('4. Try chrome://settings/content/notifications');
    }
    
    console.log('[Debug] Full system check completed');
  };

  const testUnfocusedNotification = async () => {
    try {
      addLog('Testing notification when tab loses focus...');
      addLog('ℹ️ Switch to another tab in 3 seconds...');
      
      setTimeout(async () => {
        if (Notification.permission !== 'granted') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;
        }

        const notification = new Notification('Unfocused Test', {
          body: 'This notification was created when tab was unfocused',
          requireInteraction: false,
        });

        notification.onshow = () => {
          addLog('✅ Unfocused notification shown!');
        };

        notification.onerror = (error) => {
          addLog(`❌ Unfocused notification error: ${error}`);
        };

        addLog('Unfocused notification created');
        console.log('Unfocused notification created');
      }, 3000);

    } catch (error) {
      addLog(`❌ Unfocused test failed: ${error}`);
    }
  };

  const testWithoutTag = async () => {
    try {
      addLog('Testing notification WITHOUT tag...');
      
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
      }

      // Create notification without tag to avoid grouping
      const notification = new Notification('No Tag Test', {
        body: `Test without tag - ${new Date().toLocaleTimeString()}`,
        // Explicitly don't set tag
      });

      notification.onshow = () => {
        addLog('✅ No-tag notification shown!');
      };

      notification.onerror = (error) => {
        addLog(`❌ No-tag notification error: ${error}`);
      };

      addLog('No-tag notification created');
    } catch (error) {
      addLog(`❌ No-tag test failed: ${error}`);
    }
  };

  // Monitor socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewCustomer = (data: any) => {
      addLog(`🆕 Received newCustomerNotification: ${JSON.stringify(data)}`);
    };

    const handleNewMessage = (data: any) => {
      addLog(`💬 Received newMessageNotification: ${JSON.stringify(data)}`);
    };

    const handleChatReply = (data: any) => {
      addLog(`💬 Received chatReplyNotification: ${JSON.stringify(data)}`);
    };

    socket.on('newCustomerNotification', handleNewCustomer);
    socket.on('newMessageNotification', handleNewMessage);
    socket.on('chatReplyNotification', handleChatReply);

    addLog(`Socket listeners registered`);

    return () => {
      socket.off('newCustomerNotification', handleNewCustomer);
      socket.off('newMessageNotification', handleNewMessage);
      socket.off('chatReplyNotification', handleChatReply);
    };
  }, [socket]);

  const testNotification = async () => {
    try {
      addLog('Testing notification...');
      
      // Check current permission
      const currentPermission = Notification.permission;
      addLog(`Current permission: ${currentPermission}`);
      
      if (currentPermission !== 'granted') {
        addLog('Requesting permission...');
        const newPermission = await notificationService.requestPermission();
        addLog(`Permission result: ${newPermission}`);
        
        if (newPermission !== 'granted') {
          addLog('❌ Permission denied');
          return;
        }
      }

      addLog('Creating notification...');
      const notification = await notificationService.showNotification({
        type: 'new_message',
        title: '🔔 Test Notification',
        body: 'This is a test notification from debug panel',
        requireInteraction: false,
      });

      if (notification) {
        addLog('✅ Notification object created');
        
        // Wait a bit to see if onshow fires
        setTimeout(() => {
          addLog('📊 Check console for onshow/onerror events');
        }, 1000);
      } else {
        addLog('❌ Failed to create notification object');
      }
    } catch (error) {
      addLog(`❌ Error: ${error}`);
      console.error('Test notification error:', error);
    }
  };

  const testBasicNotification = async () => {
    try {
      addLog('Testing basic browser notification...');
      
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        addLog(`Basic permission: ${permission}`);
        if (permission !== 'granted') return;
      }

      // Test most basic notification possible
      const notification = new Notification('Basic Test', {
        body: 'Basic test notification',
        requireInteraction: false,
      });

      let hasShown = false;
      let hasErrored = false;

      notification.onshow = () => {
        hasShown = true;
        addLog('✅ Basic notification SHOWN successfully!');
      };

      notification.onerror = (error) => {
        hasErrored = true;
        addLog(`❌ Basic notification ERROR: ${error}`);
        console.error('Notification error:', error);
      };

      notification.onclose = () => {
        addLog('🔔 Basic notification closed');
      };

      addLog('Basic notification object created');
      
      // Wait and check if events fired
      setTimeout(() => {
        if (!hasShown && !hasErrored) {
          addLog('⚠️ No show/error events fired after 2s');
          addLog('This might indicate browser/OS blocking');
        }
      }, 2000);

      // Try to access notification properties
      setTimeout(() => {
        try {
          addLog(`Notification title: "${notification.title}"`);
          addLog(`Notification body: "${notification.body}"`);
          addLog(`Notification tag: "${notification.tag}"`);
        } catch (e) {
          addLog(`❌ Error accessing notification properties: ${e}`);
        }
      }, 100);

    } catch (error) {
      addLog(`❌ Basic notification failed: ${error}`);
      console.error('Basic notification error:', error);
    }
  };

  const testWithSound = async () => {
    try {
      addLog('Testing notification WITH sound...');
      
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
      }

      const notification = new Notification('Sound Test', {
        body: 'This should make a sound',
        silent: false,
        requireInteraction: false,
      });

      notification.onshow = () => {
        addLog('✅ Sound notification shown!');
      };

      notification.onerror = (error) => {
        addLog(`❌ Sound notification error: ${error}`);
      };

      addLog('Sound notification created');
    } catch (error) {
      addLog(`❌ Sound notification failed: ${error}`);
    }
  };

  const testWithIcon = async () => {
    try {
      addLog('Testing notification with icon...');
      
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
      }

      // Use a data URL icon to avoid network issues
      const iconDataUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM0Yjc2ODgiLz4KPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik04IDNWMTNNMyA4SDEzIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';

      const notification = new Notification('Icon Test', {
        body: 'This has an icon',
        icon: iconDataUrl,
        requireInteraction: false,
      });

      notification.onshow = () => {
        addLog('✅ Icon notification shown!');
      };

      notification.onerror = (error) => {
        addLog(`❌ Icon notification error: ${error}`);
      };

      addLog('Icon notification created');
    } catch (error) {
      addLog(`❌ Icon notification failed: ${error}`);
    }
  };

  const testSocketEmit = () => {
    if (!socket) {
      addLog('❌ No socket connection');
      return;
    }

    // Test emitting a fake new customer event
    const testData = {
      customerId: 'test-customer-id',
      customerName: 'Test Customer',
      customerPhone: '0123456789'
    };
    
    socket.emit('newCustomerCreated', testData);
    addLog(`📤 Emitted newCustomerCreated: ${JSON.stringify(testData)}`);
  };

  const getStatusIcon = (status: boolean) => {
    return status ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getPermissionBadge = () => {
    switch (permission) {
      case 'granted':
        return <Badge variant="default" className="bg-green-100 text-green-800">Granted</Badge>;
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>;
      default:
        return <Badge variant="secondary">Default</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Notification Debug Panel
        </CardTitle>
        <CardDescription>
          Debug panel to test notification system and socket connections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Browser Support</h4>
            <div className="flex items-center gap-2">
              {getStatusIcon(isSupported)}
              <span className="text-sm">{isSupported ? 'Supported' : 'Not Supported'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Permission</h4>
            <div className="flex items-center gap-2">
              {permission === 'granted' ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              {getPermissionBadge()}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Socket Connection</h4>
            <div className="flex items-center gap-2">
              {isConnected ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-red-600" />}
              <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Socket ID</h4>
            <div className="text-sm text-muted-foreground">
              {socket?.id || 'N/A'}
            </div>
          </div>
        </div>

        {/* Settings Status */}
        <div className="space-y-2">
          <h4 className="font-medium">Notification Settings</h4>
          <div className="text-sm space-y-1">
            <div>New Customer: {settings.newCustomer ? '✅' : '❌'}</div>
            <div>New Message: {settings.newMessage ? '✅' : '❌'}</div>
            <div>Chat Reply: {settings.chatReply ? '✅' : '❌'}</div>
          </div>
        </div>

        {/* Test Actions */}
        <div className="space-y-2">
          <h4 className="font-medium">Test Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={testBasicNotification} 
              variant="outline" 
              size="sm"
              disabled={!isSupported}
            >
              Test Basic
            </Button>
            <Button 
              onClick={testWithoutTag} 
              variant="outline" 
              size="sm"
              disabled={!isSupported}
            >
              Test No Tag
            </Button>
            <Button 
              onClick={testWithSound} 
              variant="outline" 
              size="sm"
              disabled={!isSupported}
            >
              Test Sound
            </Button>
            <Button 
              onClick={testWithIcon} 
              variant="outline" 
              size="sm"
              disabled={!isSupported}
            >
              Test Icon
            </Button>
            <Button 
              onClick={testNotification} 
              variant="outline" 
              size="sm"
              disabled={!isSupported}
            >
              Test Service
            </Button>
            <Button 
              onClick={testUnfocusedNotification} 
              variant="outline" 
              size="sm"
              disabled={!isSupported}
            >
              Test Unfocused
            </Button>
            <Button 
              onClick={testSocketEmit} 
              variant="outline" 
              size="sm"
              disabled={!socket}
            >
              Test Socket
            </Button>
            <Button 
              onClick={checkSystemInfo} 
              variant="outline" 
              size="sm"
            >
              System Info
            </Button>
          </div>
        </div>

        {/* Debug Log */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Debug Log</h4>
            <Button 
              onClick={() => setDebugLog([])} 
              variant="ghost" 
              size="sm"
              className="h-6 px-2"
            >
              Clear
            </Button>
          </div>
          <div className="bg-muted p-3 rounded-md max-h-40 overflow-y-auto">
            {debugLog.length === 0 ? (
              <div className="text-sm text-muted-foreground">No events logged yet...</div>
            ) : (
              <div className="space-y-1">
                {debugLog.map((log, index) => (
                  <div key={index} className="text-xs font-mono">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Warnings */}
        {!isSupported && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your browser doesn't support Web Notifications. Please use a modern browser.
            </AlertDescription>
          </Alert>
        )}

        {permission === 'denied' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Notification permission is denied. Please enable notifications in your browser settings.
            </AlertDescription>
          </Alert>
        )}

        {!isConnected && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Socket is not connected. Notifications won't work without a socket connection.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 