import { isPasswordChangeRequired } from '../config/features.js';
import { readSessionCookie, verifySessionToken, setSessionCookie, SESSION_RENEW_BELOW_MS } from '../services/session.service.js';
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
    // Sesiones revocables (M-01): cambiar o restablecer la contraseña, o cerrar sesión, sube sessionVersion
    // y las cookies anteriores dejan de valer aunque no hayan vencido.
    if ((session.sv ?? 0) !== (user.sessionVersion ?? 0)) {
      return res.status(401).json({ error: 'Tu sesión fue cerrada. Inicia sesión nuevamente.' });
    }
    // Renovación deslizante: mientras se use la app la sesión no vence, pero una cookie robada y sin uso caduca en horas
    if (session.exp - Date.now() < SESSION_RENEW_BELOW_MS) {
      setSessionCookie(res, user.id, user.sessionVersion ?? 0);
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

// Coordinación (admin o docente): ve y gestiona todos los datos
export const isStaff = (req) => (req.userRoles || []).some(r => r === 'admin' || r === 'docente');

// Tutores además de coordinación: pasan lista y necesitan los datos de sus alumnos
export const isTutorOrStaff = (req) => isStaff(req) || (req.userRoles || []).includes('tutor');

// Destinatarios permitidos (evita usar la plataforma para mandar correos a terceros a nombre de la UFT):
//  - coordinación (admin/docente): cualquiera;
//  - tutor: sí mismo, tutores, coordinación y los alumnos de sus propias sesiones;
//  - alumno: sí mismo y coordinación.
export async function canSendTo(req, toEmail) {
  if (isStaff(req)) return true;
  const to = String(toEmail || '').trim().toLowerCase();
  if (!to || to.length > 254) return false;
  if (to === String(req.user?.email || '').trim().toLowerCase()) return true;
  const escaped = to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const target = await req.db.collection('users').findOne(
    { email: { $regex: new RegExp(`^${escaped}$`, 'i') } },
    { projection: { id: 1, role: 1, roles: 1 } }
  );
  if (!target) return false;
  const targetRoles = getUserRoles(target);
  if (targetRoles.some(r => r === 'admin' || r === 'docente')) return true;
  if (!(req.userRoles || []).includes('tutor')) return false;
  if (targetRoles.includes('tutor')) return true;
  const shared = await req.db.collection('sessions').findOne(
    { tutorId: req.user.id, $or: [{ studentIds: target.id }, { reservedForStudentId: target.id }] },
    { projection: { _id: 1 } }
  );
  return Boolean(shared);
}
