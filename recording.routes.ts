// routes/recording.routes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getPresignedUrl, saveRecording, publishRecording } from '../controllers/recording.controller';

const router = Router();
router.use(requireAuth);
router.post('/presign', getPresignedUrl);
router.post('/save', saveRecording);
router.post('/publish', publishRecording);

export default router;
