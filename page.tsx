// app/feed/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { feedApi } from '@/lib/api';
import { useAppStore } from '@/store';
import {
  Mic2, Play, TrendingUp, Sparkles, Eye,
  Clock, Tag, ChevronRight, Loader2, Home
} from 'lucide-react';
import { clsx } from 'clsx';

interface Participant {
  user: { id: string; name: string; avatarUrl: string | null };
}

interface Recording {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  storageUrl: string;
  durationSec: number;
  viewCount: number;
  publishedAt: string;
  participants: Participant[];
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function AvatarStack({ participants }: { participants: Participant[] }) {
  return (
    <div className="flex -space-x-2">
      {participants.slice(0, 2).map(({ user }, i) => (
        <div
          key={user.id}
          className="w-6 h-6 rounded-full bg-surface-3 border-2 border-surface-2 overflow-hidden flex items-center justify-center"
          style={{ zIndex: 2 - i }}
        >
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            : <span className="text-[10px] font-bold text-white/60">{user.name[0]}</span>
          }
        </div>
      ))}
    </div>
  );
}

function RecordingCard({ rec, onPlay }: { rec: Recording; onPlay: (rec: Recording) => void }) {
  const names = rec.participants.map((p) => p.user.name).join(' & ');

  return (
    <article className="card hover:border-white/10 transition-all cursor-pointer group" onClick={() => onPlay(rec)}>
      {/* Thumbnail placeholder with play overlay */}
      <div className="aspect-video bg-surface-3 rounded-2xl mb-4 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-purple-500/10" />
        <Mic2 size={32} className="text-white/10" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-brand-500/90 flex items-center justify-center shadow-lg">
            <Play size={24} className="text-white ml-1" />
          </div>
        </div>
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-md font-mono">
          {formatDuration(rec.durationSec)}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-start gap-3">
        <AvatarStack participants={rec.participants} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-1">
            {rec.title}
          </h3>
          <p className="text-xs text-white/40 truncate">{names}</p>
        </div>
      </div>

      {/* Tags + stats */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {rec.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="tag text-[11px] py-0.5">{tag}</span>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs text-white/30">
          <span className="flex items-center gap-1"><Eye size={12} />{rec.viewCount}</span>
          <span className="flex items-center gap-1"><Clock size={12} />{timeAgo(rec.publishedAt)}</span>
        </div>
      </div>
    </article>
  );
}

function PlayerModal({ rec, onClose }: { rec: Recording; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur z-50 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <AvatarStack participants={rec.participants} />
          <div>
            <p className="text-sm font-medium text-white line-clamp-1">{rec.title}</p>
            <p className="text-xs text-white/40">{rec.participants.map((p) => p.user.name).join(' & ')}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white text-xl px-2">✕</button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <div className="w-full max-w-lg">
          <video
            src={rec.storageUrl}
            controls
            autoPlay
            className="w-full rounded-2xl bg-surface-2"
            style={{ maxHeight: '60vh' }}
          />
          {rec.description && (
            <p className="text-white/50 text-sm mt-4 leading-relaxed">{rec.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {rec.tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type Tab = 'trending' | 'recommended';

export default function FeedPage() {
  const router = useRouter();
  const user   = useAppStore((s) => s.user);

  const [tab,       setTab]       = useState<Tab>('trending');
  const [recs,      setRecs]      = useState<Recording[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [page,      setPage]      = useState(1);
  const [hasMore,   setHasMore]   = useState(true);
  const [playing,   setPlaying]   = useState<Recording | null>(null);

  const load = useCallback(async (t: Tab, p: number, reset = false) => {
    setLoading(true);
    try {
      const fn    = t === 'trending' ? feedApi.trending : feedApi.recommended;
      const { data } = await fn(p);
      const fetched: Recording[] = data.recordings;

      setRecs((prev) => reset ? fetched : [...prev, ...fetched]);
      setHasMore(fetched.length >= 20);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + tab change
  useEffect(() => {
    setPage(1);
    load(tab, 1, true);
  }, [tab, load]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    load(tab, next);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-0">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface-0/95 backdrop-blur border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Mic2 className="text-brand-400" size={20} />
            <span className="font-bold text-white">PodPair</span>
          </div>
          <button
            onClick={() => router.push('/match')}
            className="flex items-center gap-1.5 text-sm text-brand-400 font-medium"
          >
            <Home size={16} />
            Match
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-1 pb-3">
          <button
            onClick={() => setTab('trending')}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              tab === 'trending'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/60'
            )}
          >
            <TrendingUp size={15} /> Trending
          </button>
          {user && (
            <button
              onClick={() => setTab('recommended')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                tab === 'recommended'
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/60'
              )}
            >
              <Sparkles size={15} /> For You
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4">
        {loading && recs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="text-brand-400 animate-spin" size={32} />
          </div>
        ) : recs.length === 0 ? (
          <div className="text-center py-20">
            <Mic2 size={40} className="text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-sm">No conversations published yet</p>
            <p className="text-white/20 text-xs mt-1">Be the first to share yours</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recs.map((rec) => (
                <RecordingCard key={rec.id} rec={rec} onPlay={setPlaying} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="btn-ghost flex items-center gap-2 text-sm"
                >
                  {loading
                    ? <Loader2 size={16} className="animate-spin" />
                    : <ChevronRight size={16} />
                  }
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 border-t border-white/5 bg-surface-0/95 backdrop-blur px-6 py-3 flex justify-around">
        <button
          onClick={() => router.push('/match')}
          className="flex flex-col items-center gap-1 text-white/30 hover:text-white/60 transition-colors"
        >
          <Home size={22} />
          <span className="text-[10px]">Match</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-brand-400">
          <TrendingUp size={22} />
          <span className="text-[10px]">Feed</span>
        </button>
      </nav>

      {/* Player modal */}
      {playing && <PlayerModal rec={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
