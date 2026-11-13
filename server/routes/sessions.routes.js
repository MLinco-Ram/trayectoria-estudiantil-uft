import { Router } from 'express';
import { getSessions, createSession, updateSession, deleteSession, registerQRAttendance, enrollSession, unenrollSession, getAttendancePin, registerPinAttendance } from '../controllers/sessions.controller.js';
import { requireRole } from '../middlewares/auth.js';

const router = Router();
const staffOnly = requireRole('admin', 'docente');
// Pasar lista y editar temario: tutores y coordinación. El alumno solo guarda su encuesta (lo valida updateSession).
const anyRole = requireRole('admin', 'docente', 'tutor', 'alumno');

router.get('/', getSessions);
router.post('/', staffOnly, createSession);
const tutorOrStaff = requireRole('admin', 'docente', 'tutor');
router.post('/attendance-pin', registerPinAttendance);
router.get('/:id/attendance-pin', tutorOrStaff, getAttendancePin);
router.post('/:id/qr-attendance', registerQRAttendance);
router.post('/:id/enroll', enrollSession);
router.delete('/:id/enroll', unenrollSession);
router.put('/:id', anyRole, updateSession);
router.delete('/:id', staffOnly, deleteSession);

export default router;
