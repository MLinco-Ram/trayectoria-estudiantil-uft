import { Router } from 'express';
import { requireRole } from '../middlewares/auth.js';
import { getReports, createReport, updateReport } from '../controllers/reports.controller.js';

const router = Router();

router.get('/', getReports);
router.post('/', createReport);
router.put('/:id', requireRole('admin', 'docente'), updateReport);

export default router;
