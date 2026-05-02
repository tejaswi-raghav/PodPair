# PodPair — Deployment Guide

## Overview

| Service     | Platform          | Cost (free tier) |
|-------------|-------------------|------------------|
| Frontend    | Vercel            | Free             |
| Backend     | Railway / Render  | ~$5/mo           |
| Database    | Railway Postgres  | ~$5/mo           |
| Redis       | Railway Redis     | ~$3/mo           |
| Storage     | Cloudflare R2     | Free (10 GB)     |
| Auth        | Firebase          | Free             |

---

## 1. Firebase Setup (Auth)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project → Enable Authentication
3. Enable providers: **Google** and **Email/Password**
4. Go to Project Settings → General → Your apps → Add Web App
5. Copy the config values into your frontend `.env.local`
6. Go to Project Settings → Service Accounts → Generate new private key
7. Save the JSON — this goes into your backend `FIREBASE_SERVICE_ACCOUNT_JSON` env var

---

## 2. Database (PostgreSQL on Railway)

```bash
# Install Railway CLI
npm i -g @railway/cli
railway login

# Create a new project
railway init

# Add PostgreSQL plugin
railway add --plugin postgresql

# Copy the DATABASE_URL from Railway dashboard → Variables
```

Run migrations once your backend is deployed:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

---

## 3. Redis (Railway)

In the same Railway project:
```bash
railway add --plugin redis
# Copy REDIS_URL from Railway Variables
```

---

## 4. Cloudflare R2 Storage

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Create a bucket: `podpair-recordings`
3. Under "Manage R2 API Tokens" → Create token with Object Read & Write
4. Copy:
   - Account ID
   - Access Key ID
   - Secret Access Key
5. Endpoint format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

Add to backend env:
```
AWS_ACCESS_KEY_ID=<r2-access-key>
AWS_SECRET_ACCESS_KEY=<r2-secret>
S3_BUCKET=podpair-recordings
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

---

## 5. Deploy Backend (Railway)

```bash
cd backend

# Connect to your Railway project
railway link

# Set environment variables (or paste in Railway dashboard)
railway variables set DATABASE_URL="..."
railway variables set REDIS_URL="..."
railway variables set FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
railway variables set AWS_ACCESS_KEY_ID="..."
railway variables set AWS_SECRET_ACCESS_KEY="..."
railway variables set S3_BUCKET="podpair-recordings"
railway variables set R2_ENDPOINT="https://..."
railway variables set FRONTEND_URL="https://your-app.vercel.app"
railway variables set NODE_ENV="production"

# Deploy
railway up
```

Your backend URL will be something like `https://podpair-backend.up.railway.app`.

**Alternative: Render.com**
1. Connect GitHub repo
2. New Web Service → select `/backend` folder
3. Build command: `npm install && npm run build && npx prisma migrate deploy`
4. Start command: `npm start`
5. Add environment variables in Render dashboard

---

## 6. Deploy Frontend (Vercel)

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

vercel login
vercel

# Follow prompts, then set env vars:
vercel env add NEXT_PUBLIC_API_URL
# → https://podpair-backend.up.railway.app/api

vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID
vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
vercel env add NEXT_PUBLIC_FIREBASE_APP_ID

# Deploy to production
vercel --prod
```

---

## 7. CORS + Firebase Auth Domain

After deploying, update:

1. **Backend**: Set `FRONTEND_URL` to your Vercel URL
2. **Firebase Console** → Authentication → Settings → Authorized domains
   - Add your Vercel domain: `your-app.vercel.app`

---

## 8. WebRTC in Production (TURN servers)

For users behind symmetric NAT (corporate networks, mobile), STUN alone will fail.
Add a TURN server to `useWebRTC.ts`:

**Option A: Twilio (pay-as-you-go)**
```typescript
// In hooks/useWebRTC.ts, replace iceServers with:
const { data } = await fetch('/api/rtc/turn-credentials').then(r => r.json());
// Backend generates short-lived Twilio TURN credentials via their API
```

**Option B: Metered.ca (free tier: 50 GB/mo)**
```typescript
iceServers: [
  { urls: 'stun:stun.metered.ca:80' },
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: process.env.NEXT_PUBLIC_METERED_USERNAME,
    credential: process.env.NEXT_PUBLIC_METERED_CREDENTIAL,
  },
]
```

---

## 9. Local Development

```bash
# 1. Start PostgreSQL and Redis (Docker)
docker run -d -p 5432:5432 -e POSTGRES_DB=podpair -e POSTGRES_PASSWORD=dev postgres:15
docker run -d -p 6379:6379 redis:7

# 2. Backend
cd backend
cp .env.example .env          # fill in values
npm install
npx prisma migrate dev        # create tables
npm run dev                   # → localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env.local    # fill in Firebase config
npm install
npm run dev                   # → localhost:3000
```

---

## 10. Environment Variables — Full Reference

### Backend

| Variable                       | Required | Description                              |
|-------------------------------|----------|------------------------------------------|
| `DATABASE_URL`                | ✅        | PostgreSQL connection string             |
| `REDIS_URL`                   | ✅        | Redis connection string                  |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅     | Firebase Admin SDK service account JSON  |
| `AWS_ACCESS_KEY_ID`           | ✅        | S3 or R2 access key                      |
| `AWS_SECRET_ACCESS_KEY`       | ✅        | S3 or R2 secret key                      |
| `S3_BUCKET`                   | ✅        | Bucket name for recordings               |
| `AWS_REGION`                  | ⚠️        | AWS region (default: us-east-1)          |
| `R2_ENDPOINT`                 | R2 only  | Cloudflare R2 endpoint URL               |
| `FRONTEND_URL`                | ✅        | Frontend origin (for CORS)               |
| `PORT`                        | ⚠️        | Server port (default: 4000)              |
| `NODE_ENV`                    | ⚠️        | production / development                 |
| `LOG_LEVEL`                   | ⚠️        | info / debug / error                     |

### Frontend

| Variable                                    | Required | Description                   |
|--------------------------------------------|----------|-------------------------------|
| `NEXT_PUBLIC_API_URL`                      | ✅        | Backend API URL               |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | ✅        | Firebase web app config       |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | ✅        | Firebase web app config       |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | ✅        | Firebase web app config       |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | ✅        | Firebase web app config       |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅        | Firebase web app config       |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | ✅        | Firebase web app config       |

---

## Production Checklist

- [ ] HTTPS everywhere (Vercel + Railway both provide this automatically)
- [ ] Firebase authorized domains updated
- [ ] CORS set to production frontend URL only
- [ ] TURN server configured for NAT traversal
- [ ] Rate limiting tuned (current: 200 req / 15 min / IP)
- [ ] Prisma migrations run on deploy (`prisma migrate deploy`)
- [ ] Redis TTLs verified (queue: 10 min, room: 2 hr)
- [ ] S3/R2 bucket CORS policy allows `PUT` from frontend origin
- [ ] Error tracking added (Sentry recommended)
- [ ] Uptime monitoring (UptimeRobot free tier works)

---

## 5. Backend Deploy (Railway)

```bash
# In Railway dashboard → New Project → Deploy from GitHub
# Set root directory to: backend
# Build command:  npm run build
# Start command:  npm start

# Add environment variables in Railway dashboard:
DATABASE_URL=...
REDIS_URL=...
FIREBASE_SERVICE_ACCOUNT_JSON=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=podpair-recordings
R2_ENDPOINT=...  # if using Cloudflare R2
FRONTEND_URL=https://your-app.vercel.app
PORT=4000
NODE_ENV=production
```

After deploy, run migrations:
```bash
railway run npx prisma migrate deploy
railway run npx prisma generate
```

---

## 6. Frontend Deploy (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

cd frontend
vercel --prod

# Or connect GitHub repo in Vercel dashboard
# Set root directory: frontend
# Build command:  npm run build
# Output directory: .next
```

Add these environment variables in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

---

## 7. Post-Deploy Checklist

- [ ] Firebase: add production domain to "Authorized domains"
- [ ] S3/R2: configure CORS to allow PUT from your Vercel domain
- [ ] Run `prisma migrate deploy` on production DB
- [ ] Test: login → match → session → rate → feed

### S3 CORS Configuration (paste in AWS Console → S3 → Permissions → CORS)
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["https://your-app.vercel.app"],
    "ExposeHeaders": []
  }
]
```

---

## 8. Environment Variables Reference

### Backend (complete list)
```env
DATABASE_URL="postgresql://user:pass@host:5432/podpair"
REDIS_URL="redis://user:pass@host:6379"
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
S3_BUCKET="podpair-recordings"
R2_ENDPOINT="https://<id>.r2.cloudflarestorage.com"  # R2 only
FRONTEND_URL="https://your-app.vercel.app"
PORT=4000
NODE_ENV="production"
LOG_LEVEL="info"
```

### Frontend (complete list)
```env
NEXT_PUBLIC_API_URL="https://your-backend.railway.app/api"
NEXT_PUBLIC_FIREBASE_API_KEY="AIza..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abc123"
```

---

## 9. TURN Server (Optional — for NAT traversal)

For production WebRTC reliability, add a TURN server to `useWebRTC.ts`:
```ts
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'user',
    credential: 'password',
  },
],
```

Free options: [Metered TURN](https://www.metered.ca/tools/openrelay/) or self-host [coturn](https://github.com/coturn/coturn).

---

## Estimated Monthly Cost (MVP)

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Hobby | Free |
| Railway (backend + postgres + redis) | Starter | ~$15/mo |
| Cloudflare R2 | Free tier (10GB) | Free |
| Firebase Auth | Spark plan | Free |
| **Total** | | **~$15/mo** |
