import { Router } from 'express';
import { getSessions, createSession, updateSession, deleteSession, registerQRAttendance } from '../controllers/sessions.controller.js';

const router = Router();

router.get('/', getSessions);
router.post('/', createSession);
router.post('/:id/qr-attendance', registerQRAttendance);
router.put('/:id', updateSession);
router.delete('/:id', deleteSession);

export default router;
