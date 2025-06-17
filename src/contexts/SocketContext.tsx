// src/contexts/SocketContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io as ioClient, type Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  useEffect(() => {
    console.log('SocketProvider: useEffect triggered for socket initialization.');
    if (typeof window !== 'undefined') {
      let newSocketInstance: Socket | null = null;
      
      if (typeof ioClient === 'function') {
        try {
          console.log('SocketProvider: Attempting to initialize Socket.IO client...');
          const socketConnectionUrl = window.location.origin; 
          console.log(`SocketProvider: Connecting to Socket.IO server at ${socketConnectionUrl} with path '/socket.io/'`);
          
          const isProd = process.env.NODE_ENV === 'production';
          newSocketInstance = ioClient(socketConnectionUrl, {
            path: '/socket.io/',
            transports: isProd ? ['polling'] : ['websocket', 'polling'],
            upgrade: !isProd,
            reconnection: true,
            reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: RECONNECT_DELAY,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 20000,
            autoConnect: true,
            forceNew: true,
            multiplex: false
          });

          if (newSocketInstance) {
            console.log('SocketProvider: Socket.IO client instance created.');
            setSocket(newSocketInstance);

            newSocketInstance.on('connect', () => {
              console.log('SocketProvider: Socket connected successfully, ID:', newSocketInstance?.id);
              setIsConnected(true);
              setReconnectAttempts(0); // Reset reconnect attempts on successful connection
            });

            newSocketInstance.on('disconnect', (reason) => {
              console.log('SocketProvider: Socket disconnected. Reason:', reason);
              setIsConnected(false);
              
              if (reason === 'io server disconnect') {
                console.warn('SocketProvider: Server deliberately disconnected socket.');
                // Server initiated disconnect - attempt to reconnect
                setTimeout(() => {
                  if (newSocketInstance) {
                    newSocketInstance.connect();
                  }
                }, RECONNECT_DELAY);
              } else if (reason === 'transport close' || reason === 'ping timeout' || reason === 'transport error') {
                console.warn('SocketProvider: Socket disconnected due to transport/ping/error issue. Will attempt to reconnect if configured.');
                // Transport issues - let the built-in reconnection handle it
              }
            });

            newSocketInstance.on('connect_error', (err) => {
              console.error('SocketProvider: Socket connection error:', err);
              setIsConnected(false);
              
              // Increment reconnect attempts
              setReconnectAttempts(prev => {
                const newAttempts = prev + 1;
                if (newAttempts >= MAX_RECONNECT_ATTEMPTS) {
                  console.error('SocketProvider: Maximum reconnection attempts reached');
                  // Optionally show a user-friendly message or trigger a fallback
                }
                return newAttempts;
              });
            });
            
            newSocketInstance.on('connect_timeout', (timeoutValue) => {
              console.error('SocketProvider: Socket connection timeout:', timeoutValue);
              setIsConnected(false);
            });

            newSocketInstance.on('error', (err) => {
              console.error('SocketProvider: Socket error:', err);
            });

            newSocketInstance.on('reconnect_attempt', (attemptNumber) => {
              console.log(`SocketProvider: Reconnect attempt ${attemptNumber}`);
            });

            newSocketInstance.on('reconnect_failed', () => {
              console.error('SocketProvider: All reconnection attempts failed');
              // Optionally show a user-friendly message or trigger a fallback
            });

            newSocketInstance.on('reconnect', (attemptNumber) => {
              console.log(`SocketProvider: Successfully reconnected after ${attemptNumber} attempts`);
              setIsConnected(true);
              setReconnectAttempts(0);
            });

          } else {
            console.error('SocketProvider: Failed to create Socket.IO client instance');
          }
        } catch (error) {
          console.error('SocketProvider: Error initializing Socket.IO client:', error);
        }
      } else {
        console.error('SocketProvider: Socket.IO client not available');
      }

      return () => {
        if (newSocketInstance) {
          console.log('SocketProvider: Cleaning up socket connection');
          newSocketInstance.disconnect();
          setSocket(null);
          setIsConnected(false);
          setReconnectAttempts(0);
        }
      };
    }
  }, []); 

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
