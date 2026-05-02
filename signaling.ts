// webrtc/signaling.ts
// WebRTC Signaling via Socket.io
//
// Flow:
//   1. Both users join their socket room (user:{id}) on connect
//   2. After match, they're told their roomToken
//   3. User A (initiator) creates RTCPeerConnection, generates offer
//   4. Offer relayed here → forwarded to User B
//   5. User B creates answer → relayed back to User A
//   6. ICE candidates exchanged in parallel
//   7. P2P connection established — signaling server no longer needed
//
// The actual audio/video data is NEVER routed through this server (pure P2P).

import { Server, Socket } from 'socket.io';
import { getRoomSession } from '../utils/redis';
import { logger } from '../utils/logger';

interface SignalingPayload {
  roomToken: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  targetUserId?: string;
}

export function registerSignalingHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const userId = socket.handshake.auth.userId as string | undefined;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    // Each user joins their personal room so the server can push to them
    socket.join(`user:${userId}`);
    logger.info(`Socket connected: ${userId} (${socket.id})`);

    // ── Join WebRTC room ──────────────────────────────────────────────────────
    socket.on('rtc:join-room', async ({ roomToken }: { roomToken: string }) => {
      const sessionId = await getRoomSession(roomToken);
      if (!sessionId) {
        socket.emit('rtc:error', { message: 'Room not found or expired' });
        return;
      }

      socket.join(`room:${roomToken}`);
      // Notify others in room that a peer is ready
      socket.to(`room:${roomToken}`).emit('rtc:peer-joined', { userId });
      logger.info(`User ${userId} joined room ${roomToken}`);
    });

    // ── SDP Offer (from initiator) ────────────────────────────────────────────
    socket.on('rtc:offer', ({ roomToken, sdp }: SignalingPayload) => {
      socket.to(`room:${roomToken}`).emit('rtc:offer', { sdp, fromUserId: userId });
    });

    // ── SDP Answer (from receiver) ────────────────────────────────────────────
    socket.on('rtc:answer', ({ roomToken, sdp }: SignalingPayload) => {
      socket.to(`room:${roomToken}`).emit('rtc:answer', { sdp, fromUserId: userId });
    });

    // ── ICE Candidates (trickle ICE) ──────────────────────────────────────────
    socket.on('rtc:ice-candidate', ({ roomToken, candidate }: SignalingPayload) => {
      socket.to(`room:${roomToken}`).emit('rtc:ice-candidate', { candidate, fromUserId: userId });
    });

    // ── Consent for recording ─────────────────────────────────────────────────
    socket.on('recording:request-consent', ({ roomToken, sessionId }: { roomToken: string; sessionId: string }) => {
      socket.to(`room:${roomToken}`).emit('recording:consent-requested', { fromUserId: userId, sessionId });
    });

    socket.on('recording:consent-given', ({ roomToken, sessionId }: { roomToken: string; sessionId: string }) => {
      socket.to(`room:${roomToken}`).emit('recording:consent-accepted', { fromUserId: userId, sessionId });
    });

    socket.on('recording:consent-denied', ({ roomToken }: { roomToken: string }) => {
      socket.to(`room:${roomToken}`).emit('recording:consent-rejected', { fromUserId: userId });
    });

    // ── Session control events ────────────────────────────────────────────────
    socket.on('session:leave', ({ roomToken }: { roomToken: string }) => {
      socket.to(`room:${roomToken}`).emit('session:partner-left', { userId });
      socket.leave(`room:${roomToken}`);
    });

    socket.on('session:mute-toggle', ({ roomToken, isMuted }: { roomToken: string; isMuted: boolean }) => {
      socket.to(`room:${roomToken}`).emit('session:partner-mute', { userId, isMuted });
    });

    socket.on('session:camera-toggle', ({ roomToken, isCameraOn }: { roomToken: string; isCameraOn: boolean }) => {
      socket.to(`room:${roomToken}`).emit('session:partner-camera', { userId, isCameraOn });
    });

    // ── Conversation prompts (bonus) ──────────────────────────────────────────
    socket.on('prompt:request', ({ roomToken }: { roomToken: string }) => {
      socket.to(`room:${roomToken}`).emit('prompt:incoming', { fromUserId: userId });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${userId}`);
    });
  });
}
