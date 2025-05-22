
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
    console.log('SocketProvider: Attempting to initialize Socket.IO client...');
    if (typeof window !== 'undefined') {
      let newSocketInstance: Socket | null = null;
      if (typeof ioClient === 'function') {
        try {
          newSocketInstance = ioClient(window.location.origin, { // Connect to the same origin as the Next.js app
            path: '/socket.io/', // Explicit path, must match server
            transports: ['websocket', 'polling'], // Try websocket first, then fallback to polling
            reconnectionAttempts: 5, // Attempt to reconnect 5 times
            reconnectionDelay: 3000, // Wait 3 seconds before attempting reconnection
            // autoConnect: true, // Default is true, explicitly stating for clarity
          });

          if (newSocketInstance) {
            console.log('SocketProvider: Socket.IO client instance created.');
            setSocket(newSocketInstance);

            newSocketInstance.on('connect', () => {
              console.log('SocketProvider: Socket connected successfully, ID:', newSocketInstance?.id);
              setIsConnected(true);
            });

            newSocketInstance.on('disconnect', (reason) => {
              console.log('SocketProvider: Socket disconnected. Reason:', reason);
              setIsConnected(false);
              if (reason === 'io server disconnect') {
                // The disconnection was initiated by the server, you need to reconnect manually if desired
                // newSocketInstance.connect(); // Or handle as per your app's logic
              }
              // Else, the client will try to reconnect automatically if configured
            });

            newSocketInstance.on('connect_error', (err) => {
              // Log the entire error object for more details
              console.error('SocketProvider: Socket connection error (connect_error event):', err);
              setIsConnected(false);
            });
            
          } else {
             console.error('SocketProvider: Socket.IO client (ioClient) did not return an instance.');
          }
        } catch (error) {
          console.error('SocketProvider: Error during Socket.IO client instantiation or event listener setup:', error);
        }
      } else {
        console.error('SocketProvider: Socket.IO client (ioClient) is not a function. Ensure socket.io-client is installed correctly and imported.');
      }

      // Cleanup on component unmount
      return () => {
        if (newSocketInstance) {
          console.log('SocketProvider: Cleaning up socket connection on component unmount...');
          newSocketInstance.disconnect();
          setSocket(null);
          setIsConnected(false);
        }
      };
    } else {
      console.log('SocketProvider: Not in a browser environment, skipping Socket.IO client initialization.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount and unmount

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
