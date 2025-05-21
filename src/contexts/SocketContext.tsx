// src/contexts/SocketContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io as ioClient, type Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Ensure this code only runs on the client-side
    if (typeof window !== 'undefined') {
      let newSocketInstance: Socket | null = null;
      try {
        // The "ioClient" is the function imported from 'socket.io-client'
        if (typeof ioClient === 'function') {
          newSocketInstance = ioClient(window.location.origin, {
            path: '/socket.io/', // Ensure this matches the server path
            transports: ['websocket'], // Prefer WebSocket
            // autoConnect: false, // Consider autoConnect: false if you want to connect manually
          });

          if (newSocketInstance) {
            setSocket(newSocketInstance);

            newSocketInstance.on('connect', () => {
              console.log('Socket connected:', newSocketInstance?.id);
              setIsConnected(true);
            });

            newSocketInstance.on('disconnect', (reason) => {
              console.log('Socket disconnected:', reason);
              setIsConnected(false);
            });

            newSocketInstance.on('connect_error', (err) => {
              console.error('Socket connection error:', err.message, err.cause);
              setIsConnected(false);
            });
            
            // newSocketInstance.connect(); // Call connect() if autoConnect is false
          } else {
             console.error('Socket.IO client (ioClient) did not return an instance.');
          }
        } else {
          console.error('Socket.IO client (ioClient) is not a function. Check installation.');
        }
      } catch (error) {
        console.error('Failed to initialize Socket.IO client:', error);
      }

      // Cleanup on component unmount
      return () => {
        if (newSocketInstance) {
          console.log('Cleaning up socket connection...');
          newSocketInstance.disconnect();
          setSocket(null);
          setIsConnected(false);
        }
      };
    }
  }, []); // Empty dependency array ensures this runs only once on mount and unmount

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
