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
      ? targetCollections.filter(c => c !== 'settings') // Proteger ajustes del sistema
      : defaultTargets;

    const results = {};

    for (const collName of collectionsToClear) {
      try {
        if (collName === 'users') {
          // Eliminar usuarios preservando estrictamente a los Administradores
          const delRes = await db.collection('users').deleteMany({
            role: { $ne: 'admin' },
            roles: { $ne: 'admin' }
          });
          results['users'] = `${delRes.deletedCount} (Admin preservados)`;
          emitEvent('users:changed', { action: 'clear_non_admin' });
        } else {
          const delRes = await db.collection(collName).deleteMany({});
          results[collName] = delRes.deletedCount;
        }
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
      message: 'Limpieza y vaciado ejecutado exitosamente en MongoDB Atlas. Los Administradores del sistema fueron preservados.',
      deletedCounts: results,
      preservedCollections: ['admin_users', 'settings'],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: `Error al vaciar los datos: ${err.message}` });
  }
});

export default systemRoutes;
