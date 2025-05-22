
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
    console.log('SocketProvider: useEffect triggered for socket initialization.');
    if (typeof window !== 'undefined') {
      console.log('SocketProvider: Attempting to initialize Socket.IO client...');
      let newSocketInstance: Socket | null = null;

      if (typeof ioClient === 'function') {
        try {
          // Attempt to connect to the Socket.IO server
          // It's assumed the server is running on the same host and port as the Next.js app
          // and listens on the path '/socket.io/'
          newSocketInstance = ioClient(window.location.origin, {
            path: '/socket.io/', // Ensure this matches the server configuration
            transports: ['websocket', 'polling'], // Default order, websocket preferred
            reconnectionAttempts: 3, // Try to reconnect a few times
            reconnectionDelay: 2000, // Wait 2 seconds between reconnection attempts
            timeout: 10000, // Client-side connection timeout: 10 seconds
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
                // This means the server deliberately disconnected the socket.
                // You might want to attempt to reconnect manually if appropriate for your app.
                // e.g., newSocketInstance.connect();
              }
              // For other reasons (like 'transport close'), the client will attempt to reconnect automatically
              // based on the reconnectionAttempts and reconnectionDelay options.
            });

            newSocketInstance.on('connect_error', (err) => {
              // This event fires when the initial connection fails or subsequent reconnections fail.
              console.error('SocketProvider: CRITICAL SOCKET CONNECTION ERROR (connect_error event). This indicates a problem reaching or handshaking with the Socket.IO server.');
              console.error('Full error object:', err); // Log the entire error object
              // err.message often includes more details like 'xhr poll error', 'websocket error', etc.
              // err.cause might provide underlying error details in some cases.
              setIsConnected(false);
            });

            newSocketInstance.on('connect_timeout', (timeout) => {
              // This event fires if the client-side `timeout` option is reached during connection attempt.
              console.error('SocketProvider: SOCKET CONNECTION TIMEOUT (connect_timeout event). Connection attempt exceeded', timeout, 'ms.');
              setIsConnected(false);
            });

            newSocketInstance.on('error', (err) => {
                // This is a general error event from the socket instance.
                console.error('SocketProvider: GENERAL SOCKET ERROR (error event). This might occur after connection.');
                console.error('Full error object:', err);
                setIsConnected(false); // Depending on the error, you might want to handle this differently
            });

          } else {
             console.error('SocketProvider: Socket.IO client (ioClient) did not return an instance. This is unexpected.');
          }
        } catch (error) {
          // Catch synchronous errors during ioClient() call or event listener setup
          console.error('SocketProvider: CRITICAL ERROR during Socket.IO client instantiation or initial event listener setup:');
          console.error(error);
        }
      } else {
        console.error('SocketProvider: Socket.IO client (ioClient) is not a function. Ensure socket.io-client is installed correctly and imported.');
      }

      // Cleanup function for when the component unmounts
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
