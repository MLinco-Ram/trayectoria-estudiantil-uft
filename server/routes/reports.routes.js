import { Router } from 'express';
import { getReports, createReport, updateReport } from '../controllers/reports.controller.js';

const router = Router();

router.get('/', getReports);
router.post('/', createReport);
router.put('/:id', updateReport);

export default router;
