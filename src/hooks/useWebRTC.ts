// hooks/useWebRTC.ts
// Manages the full WebRTC lifecycle using simple-peer + Socket.io signaling.
//
// Design decisions:
//  - simple-peer abstracts RTCPeerConnection (trickle ICE, offer/answer)
//  - We determine initiator by comparing userIds (lexicographic) to avoid
//    both peers trying to initiate simultaneously
//  - MediaRecorder runs client-side; blob chunks accumulated in a ref
//  - On session end, blob uploaded to presigned S3 URL

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { getSocket } from '@/lib/socket';
import { recordingApi } from '@/lib/api';

interface UseWebRTCOptions {
  roomToken: string;
  localUserId: string;
  remoteUserId: string;
  sessionId: string;
}

interface WebRTCState {
  localStream:   MediaStream | null;
  remoteStream:  MediaStream | null;
  isConnected:   boolean;
  isConnecting:  boolean;
  error:         string | null;
  isRecording:   boolean;
  startRecording: () => void;
  stopRecording:  () => Promise<{ storageKey: string; sizeBytes: number; durationSec: number } | null>;
  cleanup:        () => void;
}

export function useWebRTC({
  roomToken,
  localUserId,
  remoteUserId,
  sessionId,
}: UseWebRTCOptions): WebRTCState {
  const peerRef          = useRef<SimplePeer.Instance | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunks  = useRef<Blob[]>([]);
  const recordingStart   = useRef<number>(0);

  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected,  setIsConnected]  = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [isRecording,  setIsRecording]  = useState(false);

  // Initiator = lexicographically smaller userId
  // This ensures exactly one peer initiates the connection
  const isInitiator = localUserId < remoteUserId;

  useEffect(() => {
    const socket = getSocket(localUserId);
    let peer: SimplePeer.Instance;

    async function init() {
      try {
        // Get local media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Join signaling room
        socket.emit('rtc:join-room', { roomToken });

        // Create peer — initiator sends the first offer
        peer = new SimplePeer({
          initiator: isInitiator,
          stream,
          trickle: true, // trickle ICE for faster connection
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              // Add TURN servers here for production NAT traversal
            ],
          },
        });

        peerRef.current = peer;

        // simple-peer emits 'signal' whenever it has data to send
        peer.on('signal', (data) => {
          if (data.type === 'offer') {
            socket.emit('rtc:offer', { roomToken, sdp: data });
          } else if (data.type === 'answer') {
            socket.emit('rtc:answer', { roomToken, sdp: data });
          } else {
            // ICE candidate
            socket.emit('rtc:ice-candidate', { roomToken, candidate: data });
          }
        });

        peer.on('stream', (remoteStream: MediaStream) => {
          setRemoteStream(remoteStream);
          setIsConnected(true);
          setIsConnecting(false);
        });

        peer.on('connect', () => {
          setIsConnected(true);
          setIsConnecting(false);
        });

        peer.on('error', (err: Error) => {
          setError(err.message);
          setIsConnecting(false);
        });

        peer.on('close', () => {
          setIsConnected(false);
          setRemoteStream(null);
        });

        // Signaling event listeners
        socket.on('rtc:offer', ({ sdp }: { sdp: SimplePeer.SignalData }) => {
          if (!isInitiator) peer.signal(sdp);
        });

        socket.on('rtc:answer', ({ sdp }: { sdp: SimplePeer.SignalData }) => {
          if (isInitiator) peer.signal(sdp);
        });

        socket.on('rtc:ice-candidate', ({ candidate }: { candidate: RTCIceCandidateInit }) => {
          peer.signal(candidate as SimplePeer.SignalData);
        });

        socket.on('session:partner-left', () => {
          setIsConnected(false);
          setRemoteStream(null);
          setError('Your partner left the session');
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to access camera/microphone';
        setError(msg);
        setIsConnecting(false);
      }
    }

    init();

    return () => {
      socket.off('rtc:offer');
      socket.off('rtc:answer');
      socket.off('rtc:ice-candidate');
      socket.off('session:partner-left');
    };
  }, [roomToken, localUserId, isInitiator]);

  // ── Recording ───────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream || isRecording) return;

    recordingChunks.current = [];
    recordingStart.current = Date.now();

    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordingChunks.current.push(e.data);
    };
    recorder.start(1000); // chunk every second
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, [isRecording]);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecording) return null;

    return new Promise<{ storageKey: string; sizeBytes: number; durationSec: number } | null>(
      (resolve) => {
        recorder.onstop = async () => {
          const blob = new Blob(recordingChunks.current, { type: 'video/webm' });
          const durationSec = Math.round((Date.now() - recordingStart.current) / 1000);

          try {
            // Get presigned URL from backend
            const { data } = await recordingApi.presign(sessionId, 'video/webm');
            const { presignedUrl, storageKey } = data;

            // Upload directly to S3/R2 — bypasses our API server
            await fetch(presignedUrl, {
              method: 'PUT',
              body: blob,
              headers: { 'Content-Type': 'video/webm' },
            });

            resolve({ storageKey, sizeBytes: blob.size, durationSec });
          } catch {
            resolve(null);
          }

          setIsRecording(false);
        };

        recorder.stop();
      }
    );
  }, [isRecording, sessionId]);

  const cleanup = useCallback(() => {
    peerRef.current?.destroy();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current?.stop();
    peerRef.current = null;
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
  }, []);

  return {
    localStream, remoteStream, isConnected, isConnecting,
    error, isRecording, startRecording, stopRecording, cleanup,
  };
}
