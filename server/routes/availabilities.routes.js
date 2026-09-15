import { Router } from 'express';
import { getAvailabilities, saveAvailability } from '../controllers/availabilities.controller.js';

const router = Router();

router.get('/', getAvailabilities);
router.post('/', saveAvailability);

export default router;
