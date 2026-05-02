// routes/user.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getProfile, updateProfile } from '../controllers/user.controller';

const router = Router();
router.use(requireAuth);
router.get('/profile', getProfile);
router.post('/profile', updateProfile);

export default router;
