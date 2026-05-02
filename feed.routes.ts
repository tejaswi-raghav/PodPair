// routes/feed.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getTrending, getRecommended } from '../controllers/feed.controller';

const router = Router();
router.get('/trending', getTrending);               // public
router.get('/recommended', requireAuth, getRecommended); // requires auth

export default router;
