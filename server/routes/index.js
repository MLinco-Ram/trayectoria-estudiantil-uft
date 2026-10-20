import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import sessionsRoutes from './sessions.routes.js';
import roomsRoutes from './rooms.routes.js';
import availabilitiesRoutes from './availabilities.routes.js';
import reportsRoutes from './reports.routes.js';
import studentRequestsRoutes from './studentRequests.routes.js';
import notificationsRoutes from './notifications.routes.js';
import settingsRoutes from './settings.routes.js';
import broadcastRoutes from './broadcast.routes.js';
import cronRoutes from './cron.routes.js';
import emailRoutes from './email.routes.js';
import systemRoutes from './system.routes.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { registerStudent } from '../controllers/users.controller.js';
import { loginLimiter } from '../middlewares/rateLimiters.js';

const apiRouter = Router();

// Rutas públicas: login, recuperación de contraseña y registro de alumnos
apiRouter.use('/', authRoutes);
apiRouter.post('/register', loginLimiter, registerStudent);

// Todo lo que sigue exige una sesión válida
apiRouter.use(requireAuth);
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

// Montar submódulos de rutas
apiRouter.use('/users', usersRoutes);
apiRouter.use('/sessions', sessionsRoutes);
apiRouter.use('/rooms', roomsRoutes);
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
