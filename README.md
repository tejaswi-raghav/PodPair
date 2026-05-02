# 🎙️ PodPair

> Real conversations. Real people. Connect with strangers for meaningful podcast-style conversations.

PodPair is a mobile-first web app that solves loneliness among people in their 20s by enabling structured, real-time audio/video conversations between matched strangers — optionally recorded and shared.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                    │
│   Login → Match Queue → Live Session → Feed                  │
│   Firebase Auth · Zustand · Socket.io client · simple-peer  │
└────────────────────┬──────────────────────────┬─────────────┘
                     │ REST API                  │ WebSocket
                     ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND (Express + Socket.io)            │
│   Auth · Match · Session · Recording · Feed                  │
│   Firebase Admin · Prisma ORM · Redis · Winston              │
└────────┬───────────────────────┬────────────────────────────┘
         │                       │
         ▼                       ▼
  ┌─────────────┐       ┌────────────────┐
  │  PostgreSQL  │       │     Redis       │
  │  (Prisma)   │       │ Queue · Rooms  │
  └─────────────┘       └────────────────┘

         WebRTC P2P: audio/video goes directly between peers
         Recordings: uploaded directly to S3/R2 via presigned URLs
```

---

## 📁 Project Structure

```
podpair/
├── frontend/               # Next.js 14 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/      # Auth + profile setup
│   │   │   ├── match/      # Topic/mood selection + queue
│   │   │   ├── session/    # Live WebRTC call room
│   │   │   ├── feed/       # Public recordings feed
│   │   │   └── profile/    # Edit profile
│   │   ├── components/ui/  # AuthProvider
│   │   ├── hooks/          # useWebRTC, useSessionTimer
│   │   ├── lib/            # api.ts, firebase.ts, socket.ts
│   │   ├── store/          # Zustand global state
│   │   └── types/
│   └── public/manifest.json
│
├── backend/                # Express + Socket.io
│   ├── src/
│   │   ├── controllers/    # auth, match, session, recording, feed, user
│   │   ├── routes/         # Express routers
│   │   ├── middleware/     # requireAuth
│   │   ├── utils/          # prisma, redis, firebase, logger
│   │   ├── webrtc/         # signaling.ts, matchmaking.ts
│   │   └── types/
│   └── prisma/
│       ├── schema.prisma
│       ├── seed.ts
│       └── migrations/
│
└── docs/DEPLOY.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+, PostgreSQL 14+, Redis 7+, Firebase project

### 1. Install

```bash
cd backend  && npm install
cd frontend && npm install
```

### 2. Configure `.env`

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local
# Fill in Firebase, DB, Redis, S3 credentials
```

### 3. Database

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
npm run db:seed   # optional sample data
```

### 4. Run

```bash
# Terminal 1
cd backend  && npm run dev   # :4000

# Terminal 2
cd frontend && npm run dev   # :3000
```

---

## 🔑 Key Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/auth/login | — | Firebase token → user |
| POST | /api/auth/register | — | First-time onboarding |
| POST | /api/match/join-queue | ✅ | Enter matchmaking |
| POST | /api/match/leave-queue | ✅ | Exit queue |
| POST | /api/session/start | ✅ | Mark session live |
| POST | /api/session/end | ✅ | End + compute duration |
| POST | /api/session/rate | ✅ | Rate partner |
| POST | /api/recording/presign | ✅ | Get S3 upload URL |
| POST | /api/recording/save | ✅ | Save recording metadata |
| GET  | /api/feed/trending | — | Top recordings (7d) |
| GET  | /api/feed/recommended | ✅ | Interest-matched feed |

---

## 🗄️ Database Schema

```
User ─── MatchQueue (1:1 ephemeral)
  └──── Match ──── Session
                     ├── Recording ── RecordingParticipant
                     └── Rating
```

---

## 🔒 Security

- Firebase tokens verified via Admin SDK on every request
- Rate limiting: 200 req/15 min
- Helmet.js security headers
- Direct S3 upload via presigned URLs (no video through API)
- Users can only access their own sessions

---

## ✨ Bonus Features

- AI conversation prompts during sessions
- Dual-consent recording flow
- Reputation scoring system
- PWA-ready (manifest.json)
- Zustand persistence for auth state

---

See [`docs/DEPLOY.md`](./docs/DEPLOY.md) for full production deployment guide.
