// controllers/match.controller.ts
// Matching strategy:
//  1. User hits /join-queue → write to DB + Redis sorted set
//  2. Redis sorted set checked for a partner with same topic+mood
//  3. If match found → create Match + Session records → emit socket events to both
//  4. If no match → user waits, Socket.io will push when a partner arrives

import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { enqueue, dequeue, removeFromQueue, getQueueLength } from '../utils/redis';
import { io } from '../index';
import { v4 as uuidv4 } from 'uuid';

const JoinSchema = z.object({
  topic: z.string().min(1).max(50),
  mood: z.enum(['DEEP', 'FUN', 'DEBATE', 'CASUAL']),
});

// ─── POST /api/match/join-queue ───────────────────────────────────────────────
export async function joinQueue(req: Request, res: Response): Promise<void> {
  const parsed = JoinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { topic, mood } = parsed.data;
  const userId = req.user!.id;

  // Write queue entry to DB (for persistence / analytics)
  await prisma.matchQueue.upsert({
    where: { userId },
    create: {
      userId,
      topic,
      mood,
      expiresAt: new Date(Date.now() + 120_000), // 2 min TTL
    },
    update: { topic, mood, expiresAt: new Date(Date.now() + 120_000) },
  });

  // Add to Redis sorted set for fast matching
  await enqueue(topic, mood, userId);

  // Try to pop a pair immediately
  const pair = await dequeue(topic, mood);

  if (pair.length === 2) {
    const [userAId, userBId] = pair;

    // Create Match + Session atomically
    const match = await prisma.match.create({
      data: {
        userAId,
        userBId,
        topic,
        mood,
        status: 'ACTIVE',
        session: {
          create: {
            userAId,
            userBId,
            topic,
            mood,
            roomToken: uuidv4(),
            status: 'WAITING',
          },
        },
      },
      include: { session: true },
    });

    // Remove both from DB queue
    await prisma.matchQueue.deleteMany({ where: { userId: { in: [userAId, userBId] } } });

    const session = match.session!;

    // Notify both users via socket — they join the room on the client side
    io.to(`user:${userAId}`).emit('match:found', {
      matchId: match.id,
      sessionId: session.id,
      roomToken: session.roomToken,
      topic,
      mood,
      partnerId: userBId,
    });
    io.to(`user:${userBId}`).emit('match:found', {
      matchId: match.id,
      sessionId: session.id,
      roomToken: session.roomToken,
      topic,
      mood,
      partnerId: userAId,
    });

    res.json({ status: 'MATCHED', sessionId: session.id, roomToken: session.roomToken });
  } else {
    // No pair yet — user waits for socket push
    const position = await getQueueLength(topic, mood);
    res.json({ status: 'QUEUED', position });
  }
}

// ─── POST /api/match/leave-queue ─────────────────────────────────────────────
export async function leaveQueue(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  const entry = await prisma.matchQueue.findUnique({ where: { userId } });
  if (entry) {
    await removeFromQueue(entry.topic, entry.mood, userId);
    await prisma.matchQueue.delete({ where: { userId } });
  }

  res.json({ status: 'LEFT_QUEUE' });
}

// ─── GET /api/match/status ────────────────────────────────────────────────────
export async function getStatus(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  const entry = await prisma.matchQueue.findUnique({ where: { userId } });
  if (!entry) {
    res.json({ status: 'NOT_IN_QUEUE' });
    return;
  }

  const position = await getQueueLength(entry.topic, entry.mood);
  res.json({ status: 'QUEUED', topic: entry.topic, mood: entry.mood, position });
}
