// routes/session.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { startSession, endSession, rateSession } from '../controllers/session.controller';

const router = Router();
router.use(requireAuth);
router.post('/start', startSession);
router.post('/end', endSession);
router.post('/rate', rateSession);

export default router;
