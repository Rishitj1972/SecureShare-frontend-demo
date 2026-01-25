import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const socketRef = useRef(null); // prevent duplicate sockets in StrictMode

  useEffect(() => {
    if (socketRef.current) return; // ensure single instance

    const token = localStorage.getItem('token');
    if (!token) {
      console.log('[Socket] No token found, skipping socket connection');
      setSocket(null);
      return;
    }

    // Get the API URL from environment or use localhost
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    console.log('[Socket] API URL:', apiUrl);
    
    // Remove /api suffix if present to get the base URL for Socket.IO
    const socketUrl = apiUrl.replace(/\/api$/, '');
    console.log('[Socket] Connecting to:', socketUrl);

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      rejectUnauthorized: false,
      forceNew: false,
      secure: socketUrl.startsWith('https'),
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('[Socket] Connected successfully with ID:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected. Reason:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      console.error('[Socket] Error type:', error.type);
    });

    newSocket.on('error', (error) => {
      console.error('[Socket] Socket error:', error);
    });

    // User online/offline events
    newSocket.on('userOnline', (data) => {
      console.log('[Socket] User online:', data.userId);
      setOnlineUsers(prev => new Set([...prev, data.userId]));
    });

    newSocket.on('userOffline', (data) => {
      console.log('[Socket] User offline:', data.userId);
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    });

    // Listen for file received notifications
    newSocket.on('fileReceived', (fileData) => {
      console.log('[Socket] File received notification:', fileData);
    });

    return () => {
      console.log('[Socket] Cleaning up socket connection');
      newSocket.close();
      socketRef.current = null;
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};
