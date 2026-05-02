// lib/api.ts
// Axios instance that auto-injects the Firebase ID token on every request.

import axios from 'axios';
import { getIdToken } from './firebase';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  timeout: 10_000,
});

// Attach fresh token before every request
api.interceptors.request.use(async (config) => {
  const token = await getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize error messages
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Unknown error';
    return Promise.reject(new Error(message));
  }
);

// ─── Typed API calls ──────────────────────────────────────────────────────────
export const authApi = {
  login:    (idToken: string) => api.post('/auth/login', { idToken }),
  register: (payload: RegisterPayload) => api.post('/auth/register', payload),
};

export const userApi = {
  getProfile:    () => api.get('/user/profile'),
  updateProfile: (data: Partial<ProfileUpdate>) => api.post('/user/profile', data),
};

export const matchApi = {
  joinQueue:  (topic: string, mood: string) => api.post('/match/join-queue', { topic, mood }),
  leaveQueue: () => api.post('/match/leave-queue'),
  getStatus:  () => api.get('/match/status'),
};

export const sessionApi = {
  start: (sessionId: string) => api.post('/session/start', { sessionId }),
  end:   (sessionId: string) => api.post('/session/end', { sessionId }),
  rate:  (payload: RatePayload) => api.post('/session/rate', payload),
};

export const recordingApi = {
  presign: (sessionId: string, mimeType: string) =>
    api.post('/recording/presign', { sessionId, mimeType }),
  save:    (payload: SaveRecordingPayload) => api.post('/recording/save', payload),
  publish: (recordingId: string) => api.post('/recording/publish', { recordingId }),
};

export const feedApi = {
  trending:    (page = 1) => api.get(`/feed/trending?page=${page}`),
  recommended: (page = 1) => api.get(`/feed/recommended?page=${page}`),
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RegisterPayload {
  idToken: string;
  name: string;
  ageRange: string;
  bio?: string;
  interests: string[];
}

export interface ProfileUpdate {
  name: string;
  bio: string;
  ageRange: string;
  interests: string[];
}

export interface RatePayload {
  sessionId: string;
  score: number;
  isFlagged?: boolean;
  flagReason?: string;
}

export interface SaveRecordingPayload {
  sessionId: string;
  title: string;
  description?: string;
  tags: string[];
  storageKey: string;
  durationSec: number;
  sizeBytes: number;
}
