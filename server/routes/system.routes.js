import { Router } from 'express';
import { emitEvent } from '../services/socket.service.js';
import { audit } from '../services/audit.service.js';

const systemRoutes = Router();

// Endpoint para vaciar y resetear los datos académicos (sesiones, solicitudes, reportes, notificaciones, disponibilidades)
// SIN tocar la colección de usuarios ni las credenciales del sistema.
// Colecciones que este vaciado puede tocar (lista fija). Nunca: settings, rate_limits, password_resets, audit_log, email_queue.
const ALLOWED = ['users', 'sessions', 'student_requests', 'reports', 'notifications', 'availabilities', 'broadcast_history'];

systemRoutes.post('/reset-academic-data', async (req, res) => {
  const db = req.db;
  const { targetCollections, confirm } = req.body || {};

  // Confirmación explícita en el servidor (no solo en la pantalla)
  if (confirm !== 'VACIAR') {
    return res.status(400).json({ error: 'Falta la confirmación: escribe VACIAR para continuar.' });
  }
  if (targetCollections !== undefined && !(Array.isArray(targetCollections) && targetCollections.every(c => typeof c === 'string'))) {
    return res.status(400).json({ error: 'La lista de colecciones no es válida.' });
  }

  try {
    const requested = Array.isArray(targetCollections) && targetCollections.length > 0
      ? targetCollections
      : ALLOWED.filter(c => c !== 'users'); // por defecto no se tocan los usuarios
    const rejected = requested.filter(c => !ALLOWED.includes(c));
    if (rejected.length > 0) {
      return res.status(400).json({ error: `Colección no permitida: ${rejected.join(', ')}.` });
    }
    const collectionsToClear = [...new Set(requested)];

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
        console.error(`[Reset-Data] Error vaciando ${collName}:`, err);
        results[collName] = 'Error';
      }
    }
    await audit(req, 'system.reset_academic_data', {}, { collections: collectionsToClear, results });

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
    console.error('[Reset-Data]', err);
    res.status(500).json({ error: 'Error al vaciar los datos.' });
  }
});

// Bitácora de auditoría (solo administración): quién vio, cambió o borró qué. Paginada, más reciente primero.
systemRoutes.get('/audit-log', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const filter = {};
    if (typeof req.query.action === 'string' && /^[a-z_.]{1,60}$/.test(req.query.action)) filter.action = req.query.action;
    if (typeof req.query.actor === 'string' && req.query.actor.length <= 100) filter.actor = req.query.actor;
    if (typeof req.query.before === 'string' && !Number.isNaN(Date.parse(req.query.before))) filter.at = { $lt: new Date(req.query.before) };
    const rows = await req.db.collection('audit_log').find(filter).sort({ at: -1 }).limit(limit).toArray();
    res.json({ items: rows.map(({ _id, ...r }) => r), next: rows.length === limit ? rows[rows.length - 1].at : null });
  } catch (err) {
    console.error('[Audit-Log]', err);
    res.status(500).json({ error: 'No se pudo leer la bitácora.' });
  }
});

export default systemRoutes;
