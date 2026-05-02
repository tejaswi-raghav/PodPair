// app/match/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { matchApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAppStore } from '@/store';
import {
  Mic2, Zap, Heart, Flame, Coffee, Radio,
  Loader2, X, Users, ChevronRight, LogOut
} from 'lucide-react';
import { clsx } from 'clsx';
import { signOut } from '@/lib/firebase';

// ── Data ───────────────────────────────────────────────────────────────────────
const TOPICS = [
  { id: 'tech',          label: 'Tech & AI',        emoji: '💻' },
  { id: 'relationships', label: 'Relationships',     emoji: '💛' },
  { id: 'fitness',       label: 'Fitness & Health',  emoji: '🏃' },
  { id: 'travel',        label: 'Travel',            emoji: '✈️'  },
  { id: 'philosophy',    label: 'Philosophy',        emoji: '🧠' },
  { id: 'career',        label: 'Career',            emoji: '📈' },
  { id: 'creativity',    label: 'Creativity',        emoji: '🎨' },
  { id: 'random',        label: 'Random',            emoji: '🎲' },
];

const MOODS = [
  { id: 'DEEP',   label: 'Deep',   desc: 'Meaningful & honest',  icon: Heart,  color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/30' },
  { id: 'FUN',    label: 'Fun',    desc: 'Light & playful',      icon: Zap,    color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30' },
  { id: 'DEBATE', label: 'Debate', desc: 'Challenge each other', icon: Flame,  color: 'text-red-400',     bg: 'bg-red-500/10    border-red-500/30'    },
  { id: 'CASUAL', label: 'Casual', desc: 'Just hanging out',     icon: Coffee, color: 'text-green-400',   bg: 'bg-green-500/10  border-green-500/30'  },
];

// Animated dot-dot-dot
function WaitDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

// Elapsed time display
function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startTime]);

  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return <span className="font-mono text-white/50 text-sm">{m}:{s}</span>;
}

export default function MatchPage() {
  const router      = useRouter();
  const user        = useAppStore((s) => s.user);
  const setUser     = useAppStore((s) => s.setUser);
  const isInQueue   = useAppStore((s) => s.isInQueue);
  const setQueued   = useAppStore((s) => s.setQueued);
  const clearQueue  = useAppStore((s) => s.clearQueue);
  const setMatch    = useAppStore((s) => s.setActiveMatch);

  const [topic,     setTopic]     = useState('');
  const [mood,      setMood]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [queueTime, setQueueTime] = useState<number | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user, router]);

  // Listen for match events via socket
  useEffect(() => {
    if (!user) return;
    const socket = getSocket(user.id);

    socket.on('match:found', (data: any) => {
      clearQueue();
      setMatch(data);
      router.push(`/session?roomToken=${data.roomToken}&sessionId=${data.sessionId}&partnerId=${data.partnerId}`);
    });

    return () => { socket.off('match:found'); };
  }, [user, router, clearQueue, setMatch]);

  const handleJoinQueue = useCallback(async () => {
    if (!topic || !mood) {
      setError('Please select a topic and mood');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await matchApi.joinQueue(topic, mood);
      setQueued(topic, mood);
      setQueueTime(Date.now());

      // If instantly matched (rare but possible on HTTP response)
      if (data.status === 'MATCHED') {
        clearQueue();
        setMatch({ sessionId: data.sessionId, roomToken: data.roomToken, topic, mood, matchId: '', partnerId: '' });
        router.push(`/session?roomToken=${data.roomToken}&sessionId=${data.sessionId}`);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to join queue');
    } finally {
      setLoading(false);
    }
  }, [topic, mood, setQueued, clearQueue, setMatch, router]);

  const handleLeaveQueue = useCallback(async () => {
    try {
      await matchApi.leaveQueue();
    } finally {
      clearQueue();
      setQueueTime(null);
    }
  }, [clearQueue]);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    router.replace('/login');
  };

  if (!user) return null;

  // ── Waiting in queue UI ─────────────────────────────────────────────────────
  if (isInQueue) {
    const selectedTopic = TOPICS.find((t) => t.id === topic);
    const selectedMood  = MOODS.find((m) => m.id === mood);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-8">
        {/* Pulsing ring animation */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-40 h-40 rounded-full border-2 border-brand-500/30 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute w-28 h-28 rounded-full border-2 border-brand-500/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          <div className="relative w-20 h-20 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
            <Radio className="text-brand-400 animate-pulse" size={36} />
          </div>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xl font-semibold text-white">Finding your match</span>
            <WaitDots />
          </div>
          <p className="text-white/40 text-sm">
            {selectedTopic?.emoji} {selectedTopic?.label} · {selectedMood?.label} vibe
          </p>
          {queueTime && (
            <div className="mt-3">
              <ElapsedTimer startTime={queueTime} />
            </div>
          )}
        </div>

        <div className="card text-center max-w-xs w-full">
          <Users size={20} className="text-white/30 mx-auto mb-2" />
          <p className="text-white/50 text-sm">
            You'll be connected when someone with the same vibe joins
          </p>
        </div>

        <button
          onClick={handleLeaveQueue}
          className="btn-ghost flex items-center gap-2 text-red-400 border-red-500/20 hover:bg-red-500/10"
        >
          <X size={16} /> Leave queue
        </button>
      </div>
    );
  }

  // ── Selection UI ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Mic2 className="text-brand-400" size={22} />
          <span className="font-bold text-white">PodPair</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {user.avatarUrl && (
              <img src={user.avatarUrl} className="w-8 h-8 rounded-full" alt={user.name} />
            )}
            <span className="text-sm text-white/60">{user.name}</span>
          </div>
          <button onClick={handleSignOut} className="text-white/30 hover:text-white/60 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 py-6 max-w-lg mx-auto w-full">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            Hey {user.name.split(' ')[0]} 👋
          </h1>
          <p className="text-white/40 text-sm">
            What do you want to talk about today?
          </p>
        </div>

        {/* Topic selection */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Topic</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTopic(t.id)}
                className={clsx(
                  'flex items-center gap-3 p-4 rounded-2xl border transition-all text-left',
                  topic === t.id
                    ? 'bg-brand-500/15 border-brand-500/50 text-white'
                    : 'bg-surface-1 border-white/5 text-white/60 hover:border-white/15 hover:text-white/80'
                )}
              >
                <span className="text-xl">{t.emoji}</span>
                <span className="text-sm font-medium leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Mood selection */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-3">Vibe</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {MOODS.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setMood(m.id)}
                  className={clsx(
                    'flex flex-col gap-2 p-4 rounded-2xl border transition-all text-left',
                    mood === m.id
                      ? `${m.bg} text-white`
                      : 'bg-surface-1 border-white/5 text-white/60 hover:border-white/15'
                  )}
                >
                  <Icon size={20} className={mood === m.id ? m.color : 'text-white/30'} />
                  <div>
                    <div className="text-sm font-semibold">{m.label}</div>
                    <div className="text-xs text-white/40 mt-0.5">{m.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4">{error}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleJoinQueue}
          disabled={loading || !topic || !mood}
          className="btn-primary w-full flex items-center justify-center gap-2 text-base py-4"
        >
          {loading
            ? <><Loader2 size={20} className="animate-spin" /> Finding match…</>
            : <><ChevronRight size={20} /> Start matching</>
          }
        </button>

        {/* Stats strip */}
        <div className="flex justify-center gap-6 mt-6 text-center">
          <div>
            <div className="text-white text-lg font-bold">{user.totalSessions}</div>
            <div className="text-white/30 text-xs">Sessions</div>
          </div>
          <div className="w-px bg-white/10" />
          <div>
            <div className="text-white text-lg font-bold">{user.reputationScore.toFixed(1)}</div>
            <div className="text-white/30 text-xs">Rep score</div>
          </div>
          <div className="w-px bg-white/10" />
          <div>
            <div className="text-white text-lg font-bold">{user.interests.length}</div>
            <div className="text-white/30 text-xs">Interests</div>
          </div>
        </div>
      </main>
    </div>
  );
}
