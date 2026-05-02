// app/profile/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { userApi } from '@/lib/api';
import { useAppStore } from '@/store';
import { signOut } from '@/lib/firebase';
import {
  Mic2, User, ChevronLeft, Save, LogOut, Loader2, Star, Zap,
} from 'lucide-react';
import { clsx } from 'clsx';

const INTERESTS = [
  'tech', 'relationships', 'fitness', 'travel', 'philosophy',
  'career', 'creativity', 'mental health', 'finance', 'culture',
  'sports', 'food', 'politics', 'science', 'random',
];

const AGE_RANGES = [
  { value: 'AGE_18_22', label: '18–22' },
  { value: 'AGE_23_27', label: '23–27' },
  { value: 'AGE_28_32', label: '28–32' },
  { value: 'AGE_33_37', label: '33–37' },
  { value: 'AGE_38_PLUS', label: '38+' },
];

export default function ProfilePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [ageRange, setAgeRange] = useState('AGE_23_27');
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    setName(user.name);
    setBio(user.bio || '');
    setAgeRange(user.ageRange);
    setInterests(user.interests);
  }, [user, router]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 8)
    );
  };

  const handleSave = async () => {
    if (interests.length < 1) { setError('Pick at least 1 interest'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await userApi.updateProfile({ name, bio, ageRange, interests });
      setUser({ ...user!, ...data.user });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    router.replace('/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-surface-0">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <Mic2 className="text-brand-400" size={20} />
          <span className="font-bold text-white">Profile</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-white/30 hover:text-red-400 transition-colors text-sm"
        >
          <LogOut size={16} />
        </button>
      </header>

      <main className="flex-1 px-5 py-6 max-w-lg mx-auto w-full space-y-6">
        {/* Avatar + Stats */}
        <div className="flex items-center gap-4 card">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <User size={28} className="text-brand-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white truncate">{user.name}</h2>
            <p className="text-white/40 text-xs mt-0.5 truncate">{user.email}</p>
            <div className="flex gap-4 mt-2">
              <div className="text-center">
                <div className="text-white font-semibold text-sm">{user.totalSessions}</div>
                <div className="text-white/30 text-[10px]">Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-white font-semibold text-sm flex items-center gap-1">
                  <Star size={10} className="text-yellow-400" />
                  {user.reputationScore.toFixed(1)}
                </div>
                <div className="text-white/30 text-[10px]">Reputation</div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="card space-y-5">
          <h3 className="font-semibold text-white">Edit Profile</h3>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Display name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required minLength={2} maxLength={80}
            />
          </div>

          {/* Age range */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Age range</label>
            <div className="flex gap-2 flex-wrap">
              {AGE_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setAgeRange(r.value)}
                  className={clsx(
                    'mood-chip',
                    ageRange === r.value
                      ? 'bg-brand-500/20 border-brand-500/60 text-brand-400'
                      : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Bio <span className="text-white/30">(optional)</span>
            </label>
            <textarea
              className="input resize-none h-20"
              placeholder="What makes you interesting to talk to?"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
            />
            <p className="text-white/20 text-xs mt-1 text-right">{bio.length}/500</p>
          </div>

          {/* Interests */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Interests <span className="text-white/30">({interests.length}/8)</span>
            </label>
            <p className="text-xs text-white/40 mb-3">Topics you enjoy discussing</p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleInterest(tag)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    interests.includes(tag)
                      ? 'bg-brand-500/20 border-brand-500/50 text-brand-400'
                      : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleSave}
            disabled={loading}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-medium text-sm transition-all',
              saved
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : 'btn-primary'
            )}
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Saving…</>
            ) : saved ? (
              <><Zap size={16} /> Saved!</>
            ) : (
              <><Save size={16} /> Save changes</>
            )}
          </button>
        </div>

        {/* Danger zone */}
        <div className="card border-red-500/10">
          <h3 className="text-sm font-medium text-white/50 mb-3">Account</h3>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium
                       text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
