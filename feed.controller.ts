// controllers/feed.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

// ─── GET /api/feed/trending ───────────────────────────────────────────────────
// Most-viewed public recordings in the last 7 days
export async function getTrending(req: Request, res: Response): Promise<void> {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const skip = (page - 1) * limit;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const recordings = await prisma.recording.findMany({
    where: {
      isPublic: true,
      publishedAt: { gte: sevenDaysAgo },
    },
    orderBy: { viewCount: 'desc' },
    skip,
    take: limit,
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  // Increment view counts in background (fire & forget)
  const ids = recordings.map((r) => r.id);
  prisma.recording.updateMany({ where: { id: { in: ids } }, data: { viewCount: { increment: 1 } } })
    .catch(() => {/* non-critical */});

  res.json({
    recordings: recordings.map((r) => ({ ...r, sizeBytes: Number(r.sizeBytes) })),
    page,
    limit,
  });
}

// ─── GET /api/feed/recommended ────────────────────────────────────────────────
// Recordings filtered by the user's interests
export async function getRecommended(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const skip = (page - 1) * limit;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { interests: true } });

  const recordings = await prisma.recording.findMany({
    where: {
      isPublic: true,
      // Filter recordings whose tags overlap with user interests
      tags: user?.interests?.length ? { hasSome: user.interests } : undefined,
    },
    orderBy: [{ publishedAt: 'desc' }, { viewCount: 'desc' }],
    skip,
    take: limit,
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  res.json({
    recordings: recordings.map((r) => ({ ...r, sizeBytes: Number(r.sizeBytes) })),
    page,
    limit,
  });
}
