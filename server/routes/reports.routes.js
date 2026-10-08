import { Router } from 'express';
import { getReports, createReport } from '../controllers/reports.controller.js';

const router = Router();

router.get('/', getReports);
router.post('/', createReport);

export default router;
