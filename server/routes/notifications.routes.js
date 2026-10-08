import { Router } from 'express';
import { getNotifications, createNotification, markAsRead, markAllAsRead } from '../controllers/notifications.controller.js';

const router = Router();

router.get('/', getNotifications);
router.post('/', createNotification);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);

export default router;
