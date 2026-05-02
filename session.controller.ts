// controllers/session.controller.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { setRoomSession } from '../utils/redis';

const EndSchema = z.object({
  sessionId: z.string().cuid(),
});

const RateSchema = z.object({
  sessionId: z.string().cuid(),
  score: z.number().int().min(1).max(5),
  isFlagged: z.boolean().optional(),
  flagReason: z.string().max(500).optional(),
});

// ─── POST /api/session/start ──────────────────────────────────────────────────
// Called when both peers have connected in the WebRTC room.
// Updates session status and timestamps.
export async function startSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId required' });
    return;
  }

  const userId = req.user!.id;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // Only participants can start
  if (session.userAId !== userId && session.userBId !== userId) {
    res.status(403).json({ error: 'Not a participant' });
    return;
  }

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: { status: 'ACTIVE', startedAt: new Date() },
  });

  // Map roomToken → sessionId in Redis for WebRTC signaling lookups
  await setRoomSession(updated.roomToken, sessionId);

  res.json({ session: updated });
}

// ─── POST /api/session/end ────────────────────────────────────────────────────
export async function endSession(req: Request, res: Response): Promise<void> {
  const parsed = EndSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { sessionId } = parsed.data;
  const userId = req.user!.id;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.userAId !== userId && session.userBId !== userId) {
    res.status(403).json({ error: 'Not a participant' });
    return;
  }

  const endedAt = new Date();
  const durationSec = session.startedAt
    ? Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000)
    : 0;

  await prisma.$transaction([
    prisma.session.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', endedAt, durationSec },
    }),
    prisma.match.update({
      where: { id: session.matchId },
      data: { status: 'COMPLETED' },
    }),
    // Increment totalSessions for both users
    prisma.user.updateMany({
      where: { id: { in: [session.userAId, session.userBId] } },
      data: { totalSessions: { increment: 1 } },
    }),
  ]);

  res.json({ status: 'COMPLETED', durationSec });
}

// ─── POST /api/session/rate ───────────────────────────────────────────────────
// Post-session rating. Recomputes ratee's reputation score.
export async function rateSession(req: Request, res: Response): Promise<void> {
  const parsed = RateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { sessionId, score, isFlagged, flagReason } = parsed.data;
  const raterId = req.user!.id;

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.userAId !== raterId && session.userBId !== raterId) {
    res.status(403).json({ error: 'Not a participant' });
    return;
  }

  const rateeId = session.userAId === raterId ? session.userBId : session.userAId;

  // Create rating record
  const rating = await prisma.rating.create({
    data: { sessionId, raterId, rateeId, score, isFlagged: isFlagged ?? false, flagReason },
  });

  // Recompute reputation score (weighted rolling average)
  const ratings = await prisma.rating.findMany({
    where: { rateeId },
    select: { score: true },
    orderBy: { createdAt: 'desc' },
    take: 50, // last 50 ratings
  });

  const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
  const reputationScore = Math.round(avg * 2) / 2; // round to 0.5

  await prisma.user.update({
    where: { id: rateeId },
    data: { reputationScore },
  });

  res.status(201).json({ rating, newReputationScore: reputationScore });
}
