import { Router } from 'express';
import { login, forgotPassword, verifyResetToken, resetPassword } from '../controllers/auth.controller.js';
import { loginLimiter, forgotPasswordLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.get('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);

export default router;
