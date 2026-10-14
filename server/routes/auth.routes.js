import { Router } from 'express';
import { login, logout, me, forgotPassword, verifyResetToken, resetPassword } from '../controllers/auth.controller.js';
import { loginLimiter, forgotPasswordLimiter } from '../middlewares/rateLimiters.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.get('/verify-reset-token', verifyResetToken);
router.post('/reset-password', forgotPasswordLimiter, resetPassword);

export default router;
