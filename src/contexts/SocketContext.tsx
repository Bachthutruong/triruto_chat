
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
          const socketConnectionUrl = window.location.origin;
          console.log(`SocketProvider: Connecting to Socket.IO server at ${socketConnectionUrl} with path '/socket.io/'`);
          
          newSocketInstance = ioClient(socketConnectionUrl, {
            path: '/socket.io/', // Explicitly set path, must match server
            transports: ['websocket', 'polling'], 
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
            timeout: 10000, // Client-side connection attempt timeout
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
                 console.log('SocketProvider: Server deliberately disconnected socket.');
              }
            });

            newSocketInstance.on('connect_error', (err) => {
              // This event fires when the initial connection fails or subsequent reconnections fail.
              console.error('SocketProvider: CRITICAL SOCKET CONNECTION ERROR (connect_error event). This indicates a problem reaching or handshaking with the Socket.IO server.');
              console.error('Full error object:', err); // Log the entire error object
              // err.message often includes more details like 'xhr poll error', 'websocket error', etc.
              // err.cause might provide underlying error details in some cases.
              setIsConnected(false);
            });
            
            newSocketInstance.on('connect_timeout', (timeoutValue) => {
              console.error('SocketProvider: SOCKET CONNECTION TIMEOUT (connect_timeout event). Connection attempt exceeded', timeoutValue, 'ms.');
              setIsConnected(false);
            });

            newSocketInstance.on('error', (err) => {
                // This event can fire for various reasons after a connection is established or during attempts.
                console.error('SocketProvider: GENERAL SOCKET ERROR (error event).');
                console.error('Full error object:', err);
                // Consider setting isConnected to false if the error is severe, e.g., err.message.includes('TransportError')
            });

          } else {
             console.error('SocketProvider: Socket.IO client (ioClient) did not return an instance. This is unexpected.');
          }
        } catch (error) {
          console.error('SocketProvider: CRITICAL ERROR during Socket.IO client instantiation or initial event listener setup:');
          console.error(error);
        }
      } else {
        console.error('SocketProvider: Socket.IO client (ioClient) is not a function. Ensure socket.io-client is installed correctly and imported.');
      }

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
  }, []); 

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
