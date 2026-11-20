import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import sessionsRoutes from './sessions.routes.js';
import roomsRoutes from './rooms.routes.js';
import dictionaryRoutes from './dictionary.routes.js';
import availabilitiesRoutes from './availabilities.routes.js';
import reportsRoutes from './reports.routes.js';
import studentRequestsRoutes from './studentRequests.routes.js';
import notificationsRoutes from './notifications.routes.js';
import settingsRoutes from './settings.routes.js';
import broadcastRoutes from './broadcast.routes.js';
import cronRoutes from './cron.routes.js';
import emailRoutes from './email.routes.js';
import systemRoutes from './system.routes.js';
import pendingUsersRoutes from './pendingUsers.routes.js';
import { requireAuth, requireRole, requirePasswordChanged } from '../middlewares/auth.js';
import { registerStudent } from '../controllers/users.controller.js';
import { registerLimiter } from '../middlewares/rateLimiters.js';
import crypto from 'crypto';
import { mfaStatus, mfaSetup, mfaEnable, mfaDisable, mfaReset } from '../controllers/mfa.controller.js';
import { checkAndSendTutorDailyReminders, runRetention } from '../services/cron.service.js';
import { processEmailQueue } from '../services/emailQueue.service.js';
import { audit } from '../services/audit.service.js';

const apiRouter = Router();

// Rutas públicas: login, recuperación de contraseña y registro de alumnos
apiRouter.use('/', authRoutes);
apiRouter.post('/register', registerLimiter, registerStudent);

// Tarea diaria de Vercel Cron (sin sesión de usuario): recordatorios, cola de correos y retención de datos.
// Vercel envía "Authorization: Bearer <CRON_SECRET>"; sin CRON_SECRET configurado el endpoint queda deshabilitado.
apiRouter.get('/cron/daily', async (req, res) => {
  const secret = process.env.CRON_SECRET || '';
  const given = String(req.headers.authorization || '');
  const expected = `Bearer ${secret}`;
  const ok = secret.length >= 16 && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'No autorizado.' });
  try {
    const reminders = await checkAndSendTutorDailyReminders();
    const queueSent = await processEmailQueue(req.db, { maxMs: 20000 });
    const retention = await runRetention();
    await audit(req, 'cron.daily', {}, { actor: 'cron', queueSent });
    res.json({ success: true, reminders, queueSent, retention });
  } catch (err) {
    console.error('[Cron-Daily]', err);
    res.status(500).json({ error: 'Error al ejecutar la tarea diaria.' });
  }
});

// Todo lo que sigue exige una sesión válida
apiRouter.use(requireAuth);
apiRouter.use(requirePasswordChanged);
const adminOnly = requireRole('admin');

// Endpoint de verificación de salud y conexión a MongoDB
apiRouter.get('/health', adminOnly, async (req, res) => {
  try {
    const db = req.db;
    const collections = await db.listCollections().toArray();
    const stats = {};
    for (const c of collections) {
      stats[c.name] = await db.collection(c.name).countDocuments();
    }
    res.json({
      status: 'connected',
      database: db.databaseName,
      collections: stats,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});
apiRouter.get('/check-db', (req, res) => res.redirect('/api/health'));

// Verificación en dos pasos (TOTP)
apiRouter.get('/mfa', mfaStatus);
apiRouter.post('/mfa/setup', mfaSetup);
apiRouter.post('/mfa/enable', mfaEnable);
apiRouter.post('/mfa/disable', mfaDisable);
apiRouter.delete('/users/:id/mfa', adminOnly, mfaReset);

// Montar submódulos de rutas
apiRouter.use('/users', usersRoutes);
apiRouter.use('/pending-users', adminOnly, pendingUsersRoutes);
apiRouter.use('/sessions', sessionsRoutes);
apiRouter.use('/rooms', roomsRoutes);
apiRouter.use('/dictionary', dictionaryRoutes);
apiRouter.use('/availabilities', availabilitiesRoutes);
apiRouter.use('/reports', reportsRoutes);
apiRouter.use('/student-requests', studentRequestsRoutes);
apiRouter.use('/notifications', notificationsRoutes);
apiRouter.use('/settings', adminOnly, settingsRoutes);
apiRouter.use('/broadcast-message', requireRole('admin', 'docente'), broadcastRoutes);
apiRouter.use('/system', adminOnly, systemRoutes);
apiRouter.use('/', cronRoutes);
apiRouter.use('/', emailRoutes);

export default apiRouter;
