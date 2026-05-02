// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, signInWithEmail, registerWithEmail } from '@/lib/firebase';
import { authApi } from '@/lib/api';
import { useAppStore } from '@/store';
import { Mic2, Chrome, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

type Mode = 'signin' | 'signup';

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

export default function LoginPage() {
  const router   = useRouter();
  const setUser  = useAppStore((s) => s.setUser);

  const [mode,      setMode]      = useState<Mode>('signin');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [step,      setStep]      = useState<'auth' | 'profile'>('auth');

  // Auth fields
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [idToken,  setIdToken]  = useState('');

  // Profile fields
  const [name,      setName]      = useState('');
  const [ageRange,  setAgeRange]  = useState('AGE_23_27');
  const [bio,       setBio]       = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 8)
    );
  };

  // ── Google OAuth ────────────────────────────────────────────────────────────
  async function handleGoogle() {
    setLoading(true);
    setError('');
    try {
      const token = await signInWithGoogle();
      const res   = await authApi.login(token).catch((e) => {
        if (e.message === 'USER_NOT_REGISTERED') return null;
        throw e;
      });

      if (res) {
        setUser(res.data.user);
        router.replace('/match');
      } else {
        // New user — show profile setup
        setIdToken(token);
        setStep('profile');
      }
    } catch (e: any) {
      setError(e.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Email auth ──────────────────────────────────────────────────────────────
  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let token: string;
      if (mode === 'signin') {
        token = await signInWithEmail(email, password);
        const res = await authApi.login(token);
        setUser(res.data.user);
        router.replace('/match');
      } else {
        token = await registerWithEmail(email, password);
        setIdToken(token);
        setStep('profile');
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Profile submit ──────────────────────────────────────────────────────────
  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (interests.length < 2) {
      setError('Pick at least 2 interests');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.register({ idToken, name, ageRange, bio, interests });
      setUser(res.data.user);
      router.replace('/match');
    } catch (e: any) {
      setError(e.message || 'Profile setup failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Profile setup screen ────────────────────────────────────────────────────
  if (step === 'profile') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <Mic2 className="text-brand-400" size={28} />
              <span className="text-2xl font-bold text-white">PodPair</span>
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">Set up your profile</h1>
            <p className="text-white/50 text-sm">This helps us find the right conversations for you</p>
          </div>

          <form onSubmit={handleProfileSubmit} className="card space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Display name</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  className="input pl-10"
                  placeholder="How should people call you?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required minLength={2} maxLength={80}
                />
              </div>
            </div>

            {/* Age range */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Age range</label>
              <div className="flex gap-2 flex-wrap">
                {AGE_RANGES.map((r) => (
                  <button
                    key={r.value} type="button"
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
              <label className="block text-sm font-medium text-white/70 mb-2">Bio <span className="text-white/30">(optional)</span></label>
              <textarea
                className="input resize-none h-20"
                placeholder="What makes you interesting to talk to?"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
              />
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Interests <span className="text-white/30">({interests.length}/8)</span>
              </label>
              <p className="text-xs text-white/40 mb-3">Pick topics you want to discuss</p>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((tag) => (
                  <button
                    key={tag} type="button"
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

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {loading ? 'Setting up…' : 'Start connecting'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Auth screen ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-brand-500/10 border border-brand-500/20 mb-4">
            <Mic2 className="text-brand-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white">PodPair</h1>
          <p className="text-white/40 text-sm mt-2">Real conversations. Real people.</p>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-surface-1 rounded-2xl p-1 mb-6">
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={clsx(
                'flex-1 py-2.5 text-sm font-medium rounded-xl transition-all',
                mode === m ? 'bg-surface-3 text-white' : 'text-white/40 hover:text-white/60'
              )}
            >
              {m === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="btn-ghost w-full flex items-center justify-center gap-3 mb-4"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.013 17.64 11.8 17.64 9.2z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          )}
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="email" required
              className="input pl-10"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="password" required minLength={6}
              className="input pl-10"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">
          By continuing you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
