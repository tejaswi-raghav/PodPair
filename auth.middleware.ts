// middleware/auth.middleware.ts
// Validates Firebase ID token from Authorization: Bearer <token>
// Attaches the DB user record to req.user

import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken } from '../utils/firebase';
import { prisma } from '../utils/prisma';

// Extend Express Request to carry our user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        firebaseUid: string;
        email: string;
        name: string;
        reputationScore: number;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decoded = await verifyFirebaseToken(idToken);

    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { id: true, firebaseUid: true, email: true, name: true, reputationScore: true, isActive: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found — complete onboarding first' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Account suspended' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
