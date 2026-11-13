import { Router } from 'express';
import { requireRole } from '../middlewares/auth.js';
import { getStudentRequests, createStudentRequest, updateStudentRequest } from '../controllers/studentRequests.controller.js';

const router = Router();

router.get('/', getStudentRequests);
router.post('/', createStudentRequest);
router.put('/:id', requireRole('admin', 'docente'), updateStudentRequest);

export default router;
