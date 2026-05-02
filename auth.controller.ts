// controllers/auth.controller.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { verifyFirebaseToken } from '../utils/firebase';
import { prisma } from '../utils/prisma';

// ─── Validation schemas ───────────────────────────────────────────────────────
const RegisterSchema = z.object({
  idToken: z.string().min(1),
  name: z.string().min(2).max(80),
  ageRange: z.enum(['AGE_18_22', 'AGE_23_27', 'AGE_28_32', 'AGE_33_37', 'AGE_38_PLUS']),
  bio: z.string().max(500).optional(),
  interests: z.array(z.string().max(30)).min(1).max(10),
});

const LoginSchema = z.object({
  idToken: z.string().min(1),
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Called on every app open. Verifies Firebase token and returns our DB user.
export async function login(req: Request, res: Response): Promise<void> {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const decoded = await verifyFirebaseToken(parsed.data.idToken);

    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: {
        id: true, name: true, email: true, ageRange: true,
        bio: true, avatarUrl: true, interests: true,
        reputationScore: true, totalSessions: true,
      },
    });

    if (!user) {
      // New user — frontend should redirect to registration
      res.status(404).json({ error: 'USER_NOT_REGISTERED', firebaseUid: decoded.uid });
      return;
    }

    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid Firebase token' });
  }
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
// Called once after OAuth sign-in, when user fills out their profile.
export async function register(req: Request, res: Response): Promise<void> {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { idToken, name, ageRange, bio, interests } = parsed.data;

  try {
    const decoded = await verifyFirebaseToken(idToken);

    // Upsert: safe to re-call if network failed mid-registration
    const user = await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email ?? '',
        name,
        ageRange,
        bio,
        avatarUrl: decoded.picture ?? null,
        interests,
      },
      update: { name, ageRange, bio, interests }, // allow re-onboarding
      select: { id: true, name: true, email: true, ageRange: true, interests: true },
    });

    res.status(201).json({ user });
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    res.status(500).json({ error: 'Registration failed' });
  }
}
