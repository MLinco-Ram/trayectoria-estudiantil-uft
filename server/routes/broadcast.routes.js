import { Router } from 'express';
import { broadcastMessage } from '../controllers/broadcast.controller.js';

import { mailLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.post('/', mailLimiter, broadcastMessage);

export default router;
