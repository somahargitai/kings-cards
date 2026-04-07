import React, { createContext, useContext, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  connect: () => Promise<Socket>;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = async (): Promise<Socket> => {
    // Fetch token via Vercel proxy where the cookie is valid
    const res = await fetch('/api/auth/token', { credentials: 'include' });
    const data = await res.json();
    const token: string | undefined = data.token;

    // Reuse existing socket only if it's connected and already has the same token
    const existingAuth = (socketRef.current as any)?._opts?.auth;
    if (socketRef.current?.connected && existingAuth?.token === token) {
      return socketRef.current;
    }

    // Disconnect stale socket if present
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL ?? '';
    const socket = io(`${socketUrl}/game`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;
    return socket;
  };

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  };

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, connect, disconnect }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider');
  return ctx;
}
