// src/types/index.ts
// Shared frontend types for PodPair

export interface User {
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

export interface Recording {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  storageUrl: string;
  durationSec: number;
  viewCount: number;
  publishedAt: string;
  participants: { user: { id: string; name: string; avatarUrl: string | null } }[];
}

export type Mood = 'DEEP' | 'FUN' | 'DEBATE' | 'CASUAL';

export interface MatchInfo {
  matchId: string;
  sessionId: string;
  roomToken: string;
  topic: string;
  mood: Mood;
  partnerId: string;
}
