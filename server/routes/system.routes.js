import { Router } from 'express';
import { emitEvent } from '../services/socket.service.js';

const systemRoutes = Router();

// Endpoint para vaciar y resetear los datos académicos (sesiones, solicitudes, reportes, notificaciones, disponibilidades)
// SIN tocar la colección de usuarios ni las credenciales del sistema.
systemRoutes.post('/reset-academic-data', async (req, res) => {
  const db = req.db;
  const { targetCollections } = req.body || {};

  try {
    const defaultTargets = [
      'sessions',
      'student_requests',
      'reports',
      'notifications',
      'availabilities',
      'broadcast_history'
    ];

    const collectionsToClear = Array.isArray(targetCollections) && targetCollections.length > 0
      ? targetCollections.filter(c => c !== 'users' && c !== 'settings') // Proteger absolutamente usuarios y credenciales
      : defaultTargets;

    const results = {};

    for (const collName of collectionsToClear) {
      try {
        const delRes = await db.collection(collName).deleteMany({});
        results[collName] = delRes.deletedCount;
      } catch (err) {
        results[collName] = `Error: ${err.message}`;
      }
    }

    // Emitir eventos de Socket.io en tiempo real para refrescar todas las pantallas de docentes, alumnos y tutores
    emitEvent('sessions:changed', { action: 'clear_all' });
    emitEvent('student_requests:changed', { action: 'clear_all' });
    emitEvent('reports:changed', { action: 'clear_all' });
    emitEvent('notifications:changed', { action: 'clear_all' });
    emitEvent('availabilities:changed', { action: 'clear_all' });

    res.json({
      success: true,
      message: 'Datos de tutorías y actividades académicas vaciados exitosamente de MongoDB Atlas. Las cuentas de usuarios se mantuvieron intactas.',
      deletedCounts: results,
      preservedCollections: ['users', 'settings'],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: `Error al vaciar los datos: ${err.message}` });
  }
});

export default systemRoutes;
