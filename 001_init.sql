-- CreateEnum
CREATE TYPE "AgeRange" AS ENUM ('AGE_18_22', 'AGE_23_27', 'AGE_28_32', 'AGE_33_37', 'AGE_38_PLUS');
CREATE TYPE "Mood" AS ENUM ('DEEP', 'FUN', 'DEBATE', 'CASUAL');
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageRange" "AgeRange" NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "interests" TEXT[],
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_firebaseUid_idx" ON "User"("firebaseUid");
CREATE INDEX "User_reputationScore_idx" ON "User"("reputationScore");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateTable: MatchQueue
CREATE TABLE "MatchQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "mood" "Mood" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatchQueue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchQueue_userId_key" ON "MatchQueue"("userId");
CREATE INDEX "MatchQueue_topic_mood_idx" ON "MatchQueue"("topic", "mood");
CREATE INDEX "MatchQueue_joinedAt_idx" ON "MatchQueue"("joinedAt");

-- CreateTable: Match
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "mood" "Mood" NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Match_userAId_idx" ON "Match"("userAId");
CREATE INDEX "Match_userBId_idx" ON "Match"("userBId");
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateTable: Session
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "mood" "Mood" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "roomToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_matchId_key" ON "Session"("matchId");
CREATE UNIQUE INDEX "Session_roomToken_key" ON "Session"("roomToken");
CREATE INDEX "Session_status_idx" ON "Session"("status");
CREATE INDEX "Session_userAId_idx" ON "Session"("userAId");
CREATE INDEX "Session_userBId_idx" ON "Session"("userBId");
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- CreateTable: Recording
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Recording_sessionId_key" ON "Recording"("sessionId");
CREATE INDEX "Recording_isPublic_publishedAt_idx" ON "Recording"("isPublic", "publishedAt");
CREATE INDEX "Recording_viewCount_idx" ON "Recording"("viewCount");

-- CreateTable: RecordingParticipant
CREATE TABLE "RecordingParticipant" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hasConsented" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RecordingParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecordingParticipant_recordingId_userId_key" ON "RecordingParticipant"("recordingId", "userId");

-- CreateTable: Rating
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "rateeId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Rating_sessionId_raterId_key" ON "Rating"("sessionId", "raterId");
CREATE INDEX "Rating_rateeId_idx" ON "Rating"("rateeId");
CREATE INDEX "Rating_isFlagged_idx" ON "Rating"("isFlagged");

-- AddForeignKeys
ALTER TABLE "MatchQueue" ADD CONSTRAINT "MatchQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecordingParticipant" ADD CONSTRAINT "RecordingParticipant_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecordingParticipant" ADD CONSTRAINT "RecordingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_rateeId_fkey" FOREIGN KEY ("rateeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
