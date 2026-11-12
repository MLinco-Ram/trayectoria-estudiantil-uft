import { isPasswordChangeRequired } from '../config/features.js';
import { readSessionCookie, verifySessionToken } from '../services/session.service.js';
import { sendServerError } from '../utils/errors.js';

export function getUserRoles(user) {
  if (!user) return [];
  return Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role].filter(Boolean);
}

// Exige una sesión válida. Carga el usuario desde MongoDB para que roles revocados
// o cuentas eliminadas pierdan el acceso de inmediato.
export const requireAuth = async (req, res, next) => {
  try {
    const session = verifySessionToken(readSessionCookie(req));
    if (!session) {
      return res.status(401).json({ error: 'Sesión no válida o expirada. Inicia sesión nuevamente.' });
    }

    const user = await req.db.collection('users').findOne({ id: session.uid });
    if (!user) {
      return res.status(401).json({ error: 'La cuenta ya no existe. Inicia sesión nuevamente.' });
    }
    req.user = user;
    req.userRoles = getUserRoles(user);
    next();
  } catch (err) {
    sendServerError(res, err);
  }
};

// Bloquea la API mientras la cuenta tenga pendiente el cambio de contraseña inicial
// (/me, /logout y /change-password se montan antes y siguen disponibles).
export const requirePasswordChanged = (req, res, next) => {
  if (isPasswordChangeRequired() && req.user?.mustChangePassword) {
    return res.status(403).json({ error: 'Debes cambiar tu contraseña inicial antes de continuar.', mustChangePassword: true });
  }
  next();
};

// Exige que el usuario tenga al menos uno de los roles indicados (usar después de requireAuth).
export const requireRole = (...allowed) => (req, res, next) => {
  if (!req.userRoles?.some(r => allowed.includes(r))) {
    return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
  }
  next();
};
