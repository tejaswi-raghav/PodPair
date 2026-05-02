// app/session/page.tsx
'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { sessionApi, recordingApi } from '@/lib/api';
import { useAppStore } from '@/store';
import { getSocket } from '@/lib/socket';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Circle, StopCircle, Star, Flag, Loader2,
  Sparkles, ChevronRight, AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';

// AI-generated conversation prompts (bonus feature)
const PROMPTS = [
  'What's one belief you held 5 years ago that you've completely changed your mind on?',
  'If you could change one thing about how you were raised, what would it be?',
  'What's something you're working on that you rarely talk about?',
  'What's the hardest decision you've made this year?',
  'What does success mean to you right now — not in theory, but actually?',
  'What's something most people get wrong about you?',
  'What's a risk you wish you had taken?',
  'What's one thing you're trying to be better at?',
];

function VideoTile({
  stream, muted, label, isLocal, isCameraOn,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  label: string;
  isLocal?: boolean;
  isCameraOn?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={clsx(
      'relative rounded-3xl overflow-hidden bg-surface-2 border border-white/5',
      isLocal ? 'aspect-video' : 'flex-1 min-h-0'
    )}>
      {stream && isCameraOn !== false ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={clsx('w-full h-full object-cover', isLocal && 'scale-x-[-1]')}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface-3">
          <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center">
            <span className="text-2xl font-bold text-white/30">
              {label.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Label */}
      <div className="absolute bottom-3 left-3">
        <span className="text-xs font-medium text-white/70 bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
          {label} {isLocal && '(You)'}
        </span>
      </div>
    </div>
  );
}

function RatingModal({
  onSubmit, onSkip, partnerName,
}: {
  onSubmit: (score: number, flagged: boolean, reason?: string) => void;
  onSkip: () => void;
  partnerName: string;
}) {
  const [score,    setScore]    = useState(0);
  const [flagged,  setFlagged]  = useState(false);
  const [reason,   setReason]   = useState('');
  const [hovering, setHovering] = useState(0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card max-w-sm w-full animate-fade-in">
        <h2 className="text-lg font-semibold text-white mb-1">How was that?</h2>
        <p className="text-white/40 text-sm mb-6">Rate your conversation with {partnerName}</p>

        {/* Stars */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onMouseEnter={() => setHovering(s)}
              onMouseLeave={() => setHovering(0)}
              onClick={() => setScore(s)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={36}
                className={clsx(
                  'transition-colors',
                  (hovering || score) >= s ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'
                )}
              />
            </button>
          ))}
        </div>

        {/* Flag */}
        <button
          onClick={() => setFlagged((f) => !f)}
          className={clsx(
            'w-full flex items-center gap-3 p-3 rounded-2xl border text-sm mb-4 transition-all',
            flagged
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
          )}
        >
          <Flag size={16} />
          Report inappropriate behaviour
        </button>

        {flagged && (
          <textarea
            className="input resize-none h-20 mb-4 text-sm"
            placeholder="What happened? (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}

        <div className="flex gap-3">
          <button onClick={onSkip} className="btn-ghost flex-1 text-sm py-2.5">
            Skip
          </button>
          <button
            onClick={() => score > 0 && onSubmit(score, flagged, reason)}
            disabled={score === 0}
            className="btn-primary flex-1 text-sm py-2.5"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordingConsentModal({
  requesterName, onAccept, onDecline,
}: {
  requesterName: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end justify-center z-50 p-4 pb-8">
      <div className="card max-w-sm w-full animate-fade-in">
        <Circle className="text-red-400 mb-3" size={24} />
        <h2 className="text-base font-semibold text-white mb-1">{requesterName} wants to record</h2>
        <p className="text-white/40 text-sm mb-5">
          Recording starts only if you both agree. You can stop it anytime.
        </p>
        <div className="flex gap-3">
          <button onClick={onDecline} className="btn-ghost flex-1 text-sm py-2.5 text-red-400 border-red-500/20">
            Decline
          </button>
          <button onClick={onAccept} className="btn-primary flex-1 text-sm py-2.5">
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main session component ────────────────────────────────────────────────────
function SessionContent() {
  const router       = useRouter();
  const params       = useSearchParams();
  const user         = useAppStore((s) => s.user);
  const isMuted      = useAppStore((s) => s.isMuted);
  const isCameraOn   = useAppStore((s) => s.isCameraOn);
  const toggleMute   = useAppStore((s) => s.toggleMute);
  const toggleCamera = useAppStore((s) => s.toggleCamera);
  const resetMedia   = useAppStore((s) => s.resetMedia);
  const clearMatch   = useAppStore((s) => s.setActiveMatch);

  const roomToken  = params.get('roomToken') || '';
  const sessionId  = params.get('sessionId') || '';
  const partnerId  = params.get('partnerId') || '';

  const [partnerName,   setPartnerName]   = useState('Partner');
  const [showRating,    setShowRating]    = useState(false);
  const [showConsent,   setShowConsent]   = useState(false);
  const [consentFrom,   setConsentFrom]   = useState('');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [promptVisible, setPromptVisible] = useState(false);
  const [ended,         setEnded]         = useState(false);

  const {
    localStream, remoteStream, isConnected, isConnecting,
    error, isRecording, startRecording, stopRecording, cleanup,
  } = useWebRTC({
    roomToken,
    localUserId:  user?.id || '',
    remoteUserId: partnerId,
    sessionId,
  });

  const { formatted, remaining, start: startTimer } = useSessionTimer(900); // 15 min

  // Start session on backend + timer when WebRTC connects
  useEffect(() => {
    if (isConnected) {
      sessionApi.start(sessionId).catch(console.error);
      startTimer();
    }
  }, [isConnected, sessionId, startTimer]);

  // Auto-end when timer expires
  useEffect(() => {
    if (remaining === 0 && isConnected) handleEnd();
  }, [remaining]); // eslint-disable-line

  // Mute/camera sync to actual tracks
  useEffect(() => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
  }, [isMuted, localStream]);

  useEffect(() => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = isCameraOn));
  }, [isCameraOn, localStream]);

  // Socket events
  useEffect(() => {
    if (!user) return;
    const socket = getSocket(user.id);

    socket.on('recording:consent-requested', ({ fromUserId }: { fromUserId: string }) => {
      setConsentFrom(fromUserId === partnerId ? partnerName : fromUserId);
      setShowConsent(true);
    });

    socket.on('recording:consent-accepted', () => {
      startRecording();
    });

    socket.on('recording:consent-rejected', () => {
      alert('Your partner declined recording.');
    });

    return () => {
      socket.off('recording:consent-requested');
      socket.off('recording:consent-accepted');
      socket.off('recording:consent-rejected');
    };
  }, [user, partnerId, partnerName, startRecording]);

  // Broadcast mute/camera state to partner
  useEffect(() => {
    if (!user) return;
    const socket = getSocket(user.id);
    socket.emit('session:mute-toggle', { roomToken, isMuted });
  }, [isMuted, roomToken, user]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket(user.id);
    socket.emit('session:camera-toggle', { roomToken, isCameraOn });
  }, [isCameraOn, roomToken, user]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleEnd = useCallback(async () => {
    if (ended) return;
    setEnded(true);

    getSocket(user?.id).emit('session:leave', { roomToken });

    if (isRecording) {
      const result = await stopRecording();
      if (result) {
        await recordingApi.save({
          sessionId,
          title: `Conversation about ${params.get('topic') || 'life'}`,
          tags: [],
          storageKey: result.storageKey,
          durationSec: result.durationSec,
          sizeBytes: result.sizeBytes,
        }).catch(console.error);
      }
    }

    await sessionApi.end(sessionId).catch(console.error);
    cleanup();
    resetMedia();
    setShowRating(true);
  }, [ended, isRecording, sessionId, roomToken, user, stopRecording, cleanup, resetMedia, params]);

  const handleRatingSubmit = async (score: number, isFlagged: boolean, flagReason?: string) => {
    await sessionApi.rate({ sessionId, score, isFlagged, flagReason }).catch(console.error);
    clearMatch(null);
    router.replace('/match');
  };

  const handleRecordRequest = () => {
    const socket = getSocket(user?.id);
    socket.emit('recording:request-consent', { roomToken, sessionId });
    // Optimistically start local recording — will stop if partner declines
    startRecording();
  };

  const handleConsentAccept = () => {
    const socket = getSocket(user?.id);
    socket.emit('recording:consent-given', { roomToken, sessionId });
    startRecording();
    setShowConsent(false);
  };

  const handleConsentDecline = () => {
    const socket = getSocket(user?.id);
    socket.emit('recording:consent-denied', { roomToken });
    setShowConsent(false);
  };

  const showNewPrompt = () => {
    const p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    setCurrentPrompt(p);
    setPromptVisible(true);
    setTimeout(() => setPromptVisible(false), 12000);
  };

  if (!user) return null;

  // ── Connecting state ─────────────────────────────────────────────────────────
  if (isConnecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="text-brand-400 animate-spin" size={40} />
        <p className="text-white/60">Connecting to your partner…</p>
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-2xl">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          {isConnected && (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              <span className="text-red-400 text-xs font-medium">LIVE</span>
            </div>
          )}
          <span className="text-white/40 text-xs">{partnerName}</span>
        </div>

        {/* Timer */}
        <div className={clsx(
          'font-mono text-sm font-medium px-3 py-1 rounded-full border',
          remaining <= 120
            ? 'text-red-400 bg-red-500/10 border-red-500/20'
            : 'text-white/60 bg-white/5 border-white/10'
        )}>
          {formatted}
        </div>

        {/* Recording badge */}
        {isRecording && (
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-medium">REC</span>
          </div>
        )}
      </div>

      {/* Video area */}
      <div className="flex-1 flex flex-col min-h-0 relative p-3 gap-3">
        {/* Remote video (large) */}
        <VideoTile
          stream={remoteStream}
          label={partnerName}
          isCameraOn={true}
        />

        {/* Local video (PiP) */}
        <div className="absolute bottom-20 right-5 w-28 shadow-2xl rounded-2xl overflow-hidden z-10">
          <VideoTile
            stream={localStream}
            muted
            label={user.name}
            isLocal
            isCameraOn={isCameraOn}
          />
        </div>

        {/* Prompt toast */}
        {promptVisible && currentPrompt && (
          <div className="absolute top-4 left-4 right-4 animate-fade-in">
            <div className="bg-surface-3/95 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-xl">
              <div className="flex items-start gap-2">
                <Sparkles size={16} className="text-brand-400 mt-0.5 shrink-0" />
                <p className="text-white/80 text-sm leading-relaxed">{currentPrompt}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-white/5 px-4 py-4">
        <div className="flex items-center justify-around max-w-xs mx-auto">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={clsx(
              'w-14 h-14 rounded-full flex items-center justify-center transition-all',
              isMuted
                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                : 'bg-white/10 border border-white/10 text-white/80 hover:bg-white/20'
            )}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* End call */}
          <button
            onClick={handleEnd}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center shadow-lg shadow-red-500/30 transition-all"
          >
            <PhoneOff size={26} className="text-white" />
          </button>

          {/* Camera */}
          <button
            onClick={toggleCamera}
            className={clsx(
              'w-14 h-14 rounded-full flex items-center justify-center transition-all',
              !isCameraOn
                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                : 'bg-white/10 border border-white/10 text-white/80 hover:bg-white/20'
            )}
          >
            {isCameraOn ? <Video size={22} /> : <VideoOff size={22} />}
          </button>
        </div>

        {/* Secondary controls */}
        <div className="flex items-center justify-center gap-4 mt-3">
          <button
            onClick={showNewPrompt}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-brand-400 transition-colors"
          >
            <Sparkles size={14} />
            Prompt
          </button>

          {!isRecording ? (
            <button
              onClick={handleRecordRequest}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-red-400 transition-colors"
            >
              <Circle size={14} />
              Record
            </button>
          ) : (
            <button
              onClick={async () => { await stopRecording(); }}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <StopCircle size={14} />
              Stop recording
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showRating && (
        <RatingModal
          partnerName={partnerName}
          onSubmit={handleRatingSubmit}
          onSkip={() => { clearMatch(null); router.replace('/match'); }}
        />
      )}

      {showConsent && (
        <RecordingConsentModal
          requesterName={consentFrom}
          onAccept={handleConsentAccept}
          onDecline={handleConsentDecline}
        />
      )}
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="text-brand-400 animate-spin" size={40} />
      </div>
    }>
      <SessionContent />
    </Suspense>
  );
}
