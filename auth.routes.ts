// routes/auth.routes.ts
import { Router } from 'express';
import { login, register } from '../controllers/auth.controller';

const router = Router();

// POST /api/auth/login    — exchange Firebase ID token for session (returns user record)
// POST /api/auth/register — first-time user setup after OAuth
router.post('/login', login);
router.post('/register', register);

export default router;
