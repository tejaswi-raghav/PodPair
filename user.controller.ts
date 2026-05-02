// controllers/user.controller.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';

const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  bio: z.string().max(500).optional(),
  ageRange: z.enum(['AGE_18_22', 'AGE_23_27', 'AGE_28_32', 'AGE_33_37', 'AGE_38_PLUS']).optional(),
  interests: z.array(z.string().max(30)).min(1).max(10).optional(),
});

export async function getProfile(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true, name: true, email: true, ageRange: true,
      bio: true, avatarUrl: true, interests: true,
      reputationScore: true, totalSessions: true, createdAt: true,
    },
  });
  res.json({ user });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: parsed.data,
    select: {
      id: true, name: true, email: true, ageRange: true,
      bio: true, avatarUrl: true, interests: true, reputationScore: true,
    },
  });

  res.json({ user });
}
