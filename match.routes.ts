// routes/match.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { joinQueue, leaveQueue, getStatus } from '../controllers/match.controller';

const router = Router();

router.use(requireAuth); // all match routes require auth

router.post('/join-queue', joinQueue);
router.post('/leave-queue', leaveQueue);
router.get('/status', getStatus);

export default router;
