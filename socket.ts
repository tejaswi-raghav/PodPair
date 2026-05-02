// lib/socket.ts
// Socket.io client — single instance shared across the app.
// Reconnects automatically; auth userId sent on handshake.

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(userId?: string): Socket {
  if (!socket || !socket.connected) {
    socket = io(process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000', {
      auth: { userId },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export type { Socket };
