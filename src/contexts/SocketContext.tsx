
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
          newSocketInstance = ioClient(window.location.origin, { // Connect to the same origin Next.js is served from
            path: '/socket.io/', // Crucial: Must match server-side path
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
                // The server deliberately disconnected the socket
                // newSocketInstance.connect(); // Optionally attempt to reconnect
              }
            });

            newSocketInstance.on('connect_error', (err) => {
              console.error('SocketProvider: CRITICAL SOCKET CONNECTION ERROR (connect_error event). This indicates a problem reaching or handshaking with the Socket.IO server.');
              console.error('Full error object:', err); 
              setIsConnected(false);
            });
            
            newSocketInstance.on('connect_timeout', (timeoutValue) => {
              console.error('SocketProvider: SOCKET CONNECTION TIMEOUT (connect_timeout event). Connection attempt exceeded', timeoutValue, 'ms.');
              setIsConnected(false);
            });

            newSocketInstance.on('error', (err) => {
                console.error('SocketProvider: GENERAL SOCKET ERROR (error event). This might occur after connection.');
                console.error('Full error object:', err);
                // Depending on the error, you might want to set isConnected to false
                // setIsConnected(false); 
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
