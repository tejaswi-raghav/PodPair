// store/index.ts
// Zustand store — single source of truth for client state.
// Deliberately minimal: no server cache here (use SWR/React Query for that).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AppUser {
  id: string;
  name: string;
  email: string;
  ageRange: string;
  bio?: string;
  avatarUrl?: string;
  interests: string[];
  reputationScore: number;
  totalSessions: number;
}

export interface MatchInfo {
  matchId: string;
  sessionId: string;
  roomToken: string;
  topic: string;
  mood: string;
  partnerId: string;
}

interface AppState {
  // Auth
  user: AppUser | null;
  isAuthenticated: boolean;
  setUser: (user: AppUser | null) => void;

  // Matchmaking
  isInQueue: boolean;
  queueTopic: string | null;
  queueMood: string | null;
  setQueued: (topic: string, mood: string) => void;
  clearQueue: () => void;

  // Active session
  activeMatch: MatchInfo | null;
  setActiveMatch: (match: MatchInfo | null) => void;

  // UI
  isMuted: boolean;
  isCameraOn: boolean;
  toggleMute: () => void;
  toggleCamera: () => void;
  resetMedia: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),

      // Queue
      isInQueue: false,
      queueTopic: null,
      queueMood: null,
      setQueued: (topic, mood) => set({ isInQueue: true, queueTopic: topic, queueMood: mood }),
      clearQueue: () => set({ isInQueue: false, queueTopic: null, queueMood: null }),

      // Session
      activeMatch: null,
      setActiveMatch: (match) => set({ activeMatch: match }),

      // Media
      isMuted: false,
      isCameraOn: true,
      toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
      toggleCamera: () => set((s) => ({ isCameraOn: !s.isCameraOn })),
      resetMedia: () => set({ isMuted: false, isCameraOn: true }),
    }),
    {
      name: 'podpair-store',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
);
