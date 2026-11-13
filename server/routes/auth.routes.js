import { Router } from 'express';
import { login, logout, me, forgotPassword, verifyResetToken, resetPassword, changePassword, markTutorialSeen } from '../controllers/auth.controller.js';
import { loginLimiter, loginIpLimiter, forgotPasswordLimiter, resetPasswordLimiter, changePasswordLimiter } from '../middlewares/rateLimiters.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/login', loginIpLimiter, loginLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.post('/me/tutorials', requireAuth, markTutorialSeen);
router.post('/change-password', requireAuth, changePasswordLimiter, changePassword);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.get('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

export default router;
