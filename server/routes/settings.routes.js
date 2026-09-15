import { Router } from 'express';
import { getSmtpSettings, saveSmtpSettings, testSmtp } from '../controllers/settings.controller.js';

const router = Router();

router.get('/smtp', getSmtpSettings);
router.post('/smtp', saveSmtpSettings);
router.post('/smtp/test', testSmtp);

export default router;
