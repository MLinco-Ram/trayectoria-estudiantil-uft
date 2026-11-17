import { Router } from 'express';
import { getNotifications, createNotification, markAsRead, markAllAsRead, confirmNotification } from '../controllers/notifications.controller.js';

import { mailLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.get('/', getNotifications);
router.post('/', mailLimiter, createNotification);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
router.put('/:id/confirm', confirmNotification);

export default router;
