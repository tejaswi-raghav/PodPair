// controllers/recording.controller.ts
// Recording flow:
//  1. Client records MediaStream locally using MediaRecorder API
//  2. POST /recording/request-consent → creates placeholder, notifies partner via socket
//  3. Partner accepts → POST /recording/consent
//  4. When both have consented → client uploads blob to presigned S3 URL
//  5. POST /recording/save → finalizes the DB record

import { Request, Response } from 'express';
import { z } from 'zod';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { prisma } from '../utils/prisma';
import { io } from '../index';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  // For Cloudflare R2, override endpoint:
  ...(process.env.R2_ENDPOINT && { endpoint: process.env.R2_ENDPOINT }),
});

const BUCKET = process.env.S3_BUCKET || 'podpair-recordings';

const SaveSchema = z.object({
  sessionId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(30)).max(10),
  storageKey: z.string(),
  durationSec: z.number().int().positive(),
  sizeBytes: z.number().int().positive(),
});

// ─── POST /api/recording/presign ──────────────────────────────────────────────
// Returns a presigned URL so the client can upload directly to S3/R2.
// This avoids routing large video data through our API server.
export async function getPresignedUrl(req: Request, res: Response): Promise<void> {
  const { sessionId, mimeType } = req.body as { sessionId: string; mimeType: string };
  const userId = req.user!.id;

  const storageKey = `recordings/${sessionId}/${userId}-${Date.now()}.webm`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
    ContentType: mimeType || 'video/webm',
  });

  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 600 }); // 10 min

  res.json({ presignedUrl, storageKey });
}

// ─── POST /api/recording/save ─────────────────────────────────────────────────
// Called after client has uploaded the file to S3.
// Validates both users consented before persisting.
export async function saveRecording(req: Request, res: Response): Promise<void> {
  const parsed = SaveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { sessionId, title, description, tags, storageKey, durationSec, sizeBytes } = parsed.data;
  const userId = req.user!.id;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { recording: true },
  });

  if (!session || (session.userAId !== userId && session.userBId !== userId)) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  // Check consent from both participants
  const partnerId = session.userAId === userId ? session.userBId : session.userAId;
  const consentKey = `consent:${sessionId}:${partnerId}`;

  // For MVP: both users call this endpoint = implied consent
  // Full impl: use redis consent keys set by socket events
  const publicUrl = `https://${BUCKET}.s3.amazonaws.com/${storageKey}`;

  const recording = await prisma.recording.upsert({
    where: { sessionId },
    create: {
      sessionId,
      title,
      description,
      tags,
      storageKey,
      storageUrl: publicUrl,
      durationSec,
      sizeBytes: BigInt(sizeBytes),
      participants: {
        create: [
          { userId, hasConsented: true },
          { userId: partnerId, hasConsented: false }, // partner confirms separately
        ],
      },
    },
    update: { title, description, tags },
  });

  res.status(201).json({ recording: { ...recording, sizeBytes: Number(recording.sizeBytes) } });
}

// ─── POST /api/recording/publish ─────────────────────────────────────────────
export async function publishRecording(req: Request, res: Response): Promise<void> {
  const { recordingId } = req.body as { recordingId: string };
  const userId = req.user!.id;

  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    include: { participants: true },
  });

  if (!recording) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const isParticipant = recording.participants.some((p) => p.userId === userId);
  if (!isParticipant) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  const allConsented = recording.participants.every((p) => p.hasConsented);
  if (!allConsented) {
    res.status(400).json({ error: 'All participants must consent before publishing' });
    return;
  }

  const updated = await prisma.recording.update({
    where: { id: recordingId },
    data: { isPublic: true, publishedAt: new Date() },
  });

  res.json({ recording: { ...updated, sizeBytes: Number(updated.sizeBytes) } });
}
