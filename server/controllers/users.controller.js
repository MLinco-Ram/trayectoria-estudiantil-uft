import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { isPasswordChangeRequired } from '../config/features.js';
import { encryptField, decryptField, hashRut, sanitizeUserOutput } from '../services/crypto.service.js';
import { emitEvent } from '../services/socket.service.js';
import { setSessionCookie } from '../services/session.service.js';
import { getUserRoles, isStaff } from '../middlewares/auth.js';
import { sendServerError } from '../utils/errors.js';
import { sendEmail, formatInitialPasswordEmail } from '../services/email.service.js';
import { audit } from '../services/audit.service.js';
import { isValidRut, RUT_ERROR, isValidName, NAME_ERROR } from '../utils/rut.js';
import { generateInitialPassword, initialPasswordExpiry, validatePasswordPolicy } from '../services/password.service.js';

const ALUMNO_EMAIL_DOMAINS = ['@uft.cl', '@mail.uft.cl', '@uft.edu'];

const PRIVILEGED = ['admin', 'docente'];
const KNOWN_ROLES = ['admin', 'docente', 'tutor', 'alumno'];
const validRoles = (role, roles) =>
  (role === undefined || KNOWN_ROLES.includes(role)) &&
  (roles === undefined || (Array.isArray(roles) ? roles : [roles]).every(r => KNOWN_ROLES.includes(r)));
const includesPrivileged = (role, roles) =>
  PRIVILEGED.includes(role) || (Array.isArray(roles) ? roles.some(r => PRIVILEGED.includes(r)) : PRIVILEGED.includes(roles));

async function findUserById(db, id) {
  return db.collection('users').findOne({ $or: [{ id }, { rutHash: hashRut(id) }, { rut: id }] });
}

// Solo un administrador puede crear, editar o eliminar cuentas con rol admin o docente, o asignar esos roles.
// Un docente no puede tocar la cuenta de otro docente (cambiarle el correo y pedir "olvidé mi contraseña" sería tomarla) (A-02).
function rejectAdminChangeByNonAdmin(req, res, { targetUser, role, roles } = {}) {
  if (req.userRoles.includes('admin')) return false;
  const targetIsPrivileged = getUserRoles(targetUser).some(r => PRIVILEGED.includes(r));
  const targetIsOther = targetUser && targetUser.id !== req.user.id;
  if (includesPrivileged(role, roles) || (targetIsPrivileged && targetIsOther) || (targetUser && getUserRoles(targetUser).includes('admin'))) {
    res.status(403).json({ error: 'Solo un administrador puede gestionar cuentas o permisos de administrador y docente.' });
    return true;
  }
  return false;
}

const publicContact = (u, withEmail) => ({
  id: u.id, name: u.name, role: u.role, roles: u.roles, tutorTypes: u.tutorTypes, tutorType: u.tutorType,
  ...(withEmail ? { email: u.email } : {})
});

// Sin RUT ni contraseña: datos mínimos de un alumno para el tutor que lo atiende
const studentForTutor = (u) => {
  const { rut, ...rest } = sanitizeUserOutput(u);
  return rest;
};

export const getUsers = async (req, res) => {
  const db = req.db;
  try {
    // Coordinación (admin y docente) ve a todos, con RUT
    if (isStaff(req)) {
      await audit(req, 'users.list_full');
      const users = await db.collection('users').find({}).toArray();
      return res.json(users.map(u => sanitizeUserOutput(u)));
    }

    const isTutor = (req.userRoles || []).includes('tutor');
    // Alumnos y tutores: se ve la cuenta propia, a los tutores y a coordinación (solo nombre; coordinación con correo).
    const staffFilter = { $or: [{ role: { $in: ['tutor', 'docente'] } }, { roles: { $in: ['tutor', 'docente'] } }] };
    const contacts = await db.collection('users').find(staffFilter).toArray();
    const visible = [sanitizeUserOutput(req.user)];
    for (const u of contacts) {
      if (u.id === req.user.id) continue;
      const roles = getUserRoles(u);
      visible.push(publicContact(u, roles.includes('docente') || isTutor));
    }

    // Un tutor además ve (sin RUT) solo a los alumnos de sus propias sesiones
    if (isTutor) {
      const mine = await db.collection('sessions')
        .find({ tutorId: req.user.id }, { projection: { studentIds: 1, reservedForStudentId: 1 } }).toArray();
      const studentIds = new Set(mine.flatMap(s => [...(s.studentIds || []), ...(s.reservedForStudentId ? [s.reservedForStudentId] : [])]));
      studentIds.delete(req.user.id);
      if (studentIds.size > 0) {
        const students = await db.collection('users').find({ id: { $in: [...studentIds] } }).toArray();
        const known = new Set(visible.map(v => v.id));
        for (const u of students) if (!known.has(u.id)) visible.push(studentForTutor(u));
      }
    }
    res.json(visible);
  } catch (err) {
    sendServerError(res, err);
  }
};

// Envía la contraseña inicial (aleatoria) por correo, avisando cuándo vence. Devuelve true solo si salió por SMTP real (no simulado).
async function sendInitialPasswordEmail(user, initialPassword, expiresAt) {
  const { subject, text, html } = formatInitialPasswordEmail({
    name: user.name,
    email: user.email,
    password: initialPassword,
    expiresAt,
    hasRut: Boolean(user.rut),
    mustChange: isPasswordChangeRequired(),
  });
  const mail = await sendEmail({ to: user.email, toName: user.name, subject, text, html, actionText: 'Ingresar a la Plataforma' });
  return !mail?.simulated;
}

// Cuentas sin RUT (registradas desde Pendientes): se identifican y entran solo con su correo
async function insertUserWithoutRut(db, newUser) {
  if (!isValidName(newUser.name)) return { error: NAME_ERROR };
  if (typeof newUser.email !== 'string' || newUser.email.length > 254) return { error: 'La cuenta necesita un correo válido para poder ingresar.' };
  const email = (newUser.email || '').trim().toLowerCase();
  if (!email) return { error: 'La cuenta necesita un correo para poder ingresar.' };
  newUser.email = email;
  if (await findUserByEmail(db, email)) {
    return { error: 'El correo ya se encuentra registrado en el sistema.' };
  }
  delete newUser.rut;
  newUser.password = await bcrypt.hash(newUser.password, await bcrypt.genSalt(10));
  if (!newUser.createdAt) newUser.createdAt = new Date().toISOString();
  await db.collection('users').insertOne(newUser);
  const safeResult = sanitizeUserOutput(newUser);
  emitEvent('users:changed', { action: 'create', user: safeResult });
  return { user: safeResult };
}

export function findUserByEmail(db, email) {
  const escaped = String(email || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return db.collection('users').findOne({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } });
}

// Campos que el cliente puede enviar al crear una cuenta
const CREATABLE_FIELDS = ['name', 'rut', 'email', 'career', 'role', 'roles', 'tutorType', 'tutorTypes', 'assignedTutorIds'];

const EMAIL_TAKEN = 'El correo ya se encuentra registrado en el sistema.';

async function insertUser(db, newUser) {
  // Validación de seguridad de RUT (exactamente 9 caracteres ignorando puntos y guión)
  if (typeof newUser.rut !== 'string') return { error: RUT_ERROR };
  const cleanRut = (newUser.rut || '').replace(/[\.\-]/g, '').trim();
  if (cleanRut.length !== 9) {
    return { error: "El RUT debe tener exactamente 9 dígitos/caracteres (ej: 123456789 o 12.345.678-9)." };
  }
  if (!isValidRut(cleanRut)) return { error: RUT_ERROR };
  if (!isValidName(newUser.name)) return { error: NAME_ERROR };
  if (newUser.career !== undefined && (typeof newUser.career !== 'string' || newUser.career.length > 200)) {
    return { error: 'La carrera no es válida (máximo 200 caracteres).' };
  }
  if (newUser.email !== undefined && (typeof newUser.email !== 'string' || newUser.email.length > 254)) {
    return { error: 'El correo no es válido.' };
  }

  const rutBlindIndex = hashRut(cleanRut);

  // Verificar si ya existe un usuario con este RUT usando el Blind Index seguro
  const existing = await db.collection('users').findOne({ rutHash: rutBlindIndex });
  if (existing) {
    return { error: "El RUT ya se encuentra registrado en el sistema." };
  }

  // Un correo = una cuenta (el índice único email_unique lo garantiza también en la BD)
  if (newUser.email) {
    newUser.email = newUser.email.trim().toLowerCase();
    if (await findUserByEmail(db, newUser.email)) return { error: EMAIL_TAKEN };
  }

  if (newUser.password) {
    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(newUser.password, salt);
  }

  if (!newUser.createdAt) newUser.createdAt = new Date().toISOString();

  const plainRut = newUser.rut;
  // Cifrar el RUT en reposo antes de guardar en MongoDB Atlas
  newUser.rut = encryptField(plainRut);
  newUser.rutHash = rutBlindIndex;

  await db.collection('users').insertOne(newUser);
  
  const safeResult = sanitizeUserOutput({ ...newUser, rut: plainRut });
  emitEvent('users:changed', { action: 'create', user: safeResult });
  return { user: safeResult };
}

// Crea una cuenta con una contraseña inicial ALEATORIA (temporal, 7 días) y se la envía por correo.
// La usan el alta manual (Docente/Admin) y el registro de pendientes importados desde Excel.
// Con `withoutRut` (uso interno desde Pendientes) la cuenta se crea sin RUT y entra con su correo.
export async function createAccountWithInitialPassword(db, data, withoutRut = false) {
  // Lista blanca de campos: el cliente nunca decide el id ni campos internos (_id, rutHash, contraseña...).
  const src = data || {};
  const newUser = {};
  for (const key of CREATABLE_FIELDS) if (src[key] !== undefined) newUser[key] = src[key];
  newUser.id = crypto.randomUUID();

  // Nunca se acepta ni se devuelve una contraseña desde el cliente; se comunica solo por correo.
  const initialPassword = generateInitialPassword();
  newUser.password = initialPassword;
  newUser.initialPasswordExpiresAt = initialPasswordExpiry();
  if (isPasswordChangeRequired()) newUser.mustChangePassword = true;

  const result = withoutRut ? await insertUserWithoutRut(db, newUser) : await insertUser(db, newUser);
  if (result.error) return { error: result.error };

  let emailSent = false;
  if (newUser.email) {
    try {
      emailSent = await sendInitialPasswordEmail(newUser, initialPassword, newUser.initialPasswordExpiresAt);
    } catch (mailErr) {
      console.warn('[Mail] No se pudo enviar el correo de bienvenida:', mailErr.message);
    }
  }
  return { user: result.user, emailSent };
}

// Alta de usuarios desde los paneles de Docente y Administrador
export const createUser = async (req, res) => {
  try {
    const body = req.body || {};
    if (!validRoles(body.role, body.roles)) return res.status(400).json({ error: 'Rol no válido.' });
    if (rejectAdminChangeByNonAdmin(req, res, { role: body.role, roles: body.roles })) return;
    const result = await createAccountWithInitialPassword(req.db, body);
    if (result.error) return res.status(400).json({ error: result.error });
    await audit(req, 'user.create', { userId: result.user.id }, { roles: result.user.roles || [result.user.role] });
    res.status(201).json({ ...result.user, emailSent: result.emailSent });
  } catch (err) {
    sendServerError(res, err);
  }
};

// Registro público: solo crea cuentas de alumno e inicia su sesión
export const registerStudent = async (req, res) => {
  try {
    const { name, rut, email, career, password } = req.body || {};
    if (![name, rut, email, password].every(v => typeof v === 'string' && v.trim())) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }
    if (!isValidName(name)) return res.status(400).json({ error: NAME_ERROR });
    if (email.length > 254 || (career !== undefined && (typeof career !== 'string' || career.length > 200))) {
      return res.status(400).json({ error: 'El correo o la carrera no son válidos.' });
    }
    if (!isValidRut(rut)) return res.status(400).json({ error: RUT_ERROR });
    const cleanEmail = email.trim().toLowerCase();
    if (!ALUMNO_EMAIL_DOMAINS.some(d => cleanEmail.endsWith(d))) {
      return res.status(400).json({ error: 'El correo institucional debe tener dominio oficial de la universidad.' });
    }
    const policyError = validatePasswordPolicy(password, { rut, email: cleanEmail, name });
    if (policyError) return res.status(400).json({ error: policyError });

    // Un correo = una cuenta. Si ya existe (p. ej. importada desde Pendientes), no se puede "reclamar" registrándose:
    // la persona entra con la contraseña temporal que recibió, o usa "¿Olvidaste tu contraseña?" (A-08).
    if (await findUserByEmail(req.db, cleanEmail)) {
      return res.status(409).json({ error: 'Ya existe una cuenta con este correo. Ingresa con tu correo y contraseña, o usa "¿Olvidaste tu contraseña?".' });
    }

    const result = await insertUser(req.db, {
      id: crypto.randomUUID(),
      name: name.trim(),
      rut: rut.trim(),
      role: 'alumno',
      roles: ['alumno'],
      email: cleanEmail,
      career: typeof career === 'string' ? career.trim() : '',
      password: password.trim()
    });
    if (result.error) return res.status(400).json({ error: result.error });

    setSessionCookie(res, result.user.id, 0);
    res.status(201).json(result.user);
  } catch (err) {
    sendServerError(res, err);
  }
};

// Genera una contraseña temporal NUEVA y aleatoria, la envía por correo y exige cambiarla al ingresar.
// El correo se envía antes de guardar: si falla, la contraseña actual del usuario no cambia.
export const sendInitialPassword = async (req, res) => {
  try {
    const targetUser = await findUserById(req.db, req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (rejectAdminChangeByNonAdmin(req, res, { targetUser })) return;
    if (!targetUser.email) return res.status(400).json({ error: 'El usuario no tiene un correo registrado.' });

    const initialPassword = generateInitialPassword();
    const expiresAt = initialPasswordExpiry();
    const sent = await sendInitialPasswordEmail(targetUser, initialPassword, expiresAt);
    if (!sent) {
      return res.status(503).json({ error: 'El servidor de correo (SMTP) no está configurado. No se cambió la contraseña.' });
    }

    const hashed = await bcrypt.hash(initialPassword, await bcrypt.genSalt(10));
    await req.db.collection('users').updateOne(
      { _id: targetUser._id },
      { $set: { password: hashed, initialPasswordExpiresAt: expiresAt, ...(isPasswordChangeRequired() ? { mustChangePassword: true } : {}) },
        $inc: { sessionVersion: 1 },
        ...(isPasswordChangeRequired() ? {} : { $unset: { mustChangePassword: '' } }) }
    );
    await audit(req, 'user.initial_password_sent', { userId: targetUser.id });
    res.json({ success: true, message: `Contraseña temporal enviada a ${targetUser.email}.` });
  } catch (err) {
    sendServerError(res, err, 'No se pudo enviar la contraseña por correo.');
  }
};

export const updateUser = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const { email, name, career, rut, password, tutorType, tutorTypes, assignedTutorIds, role, roles } = req.body;
    const targetUser = await findUserById(db, id);
    if (!targetUser) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    if (!validRoles(role, roles)) return res.status(400).json({ error: 'Rol no válido.' });
    if (rejectAdminChangeByNonAdmin(req, res, { targetUser, role, roles })) return;

    const updateData = {};
    let sessionBump = false;
    if (email !== undefined) {
      if (typeof email !== 'string' || email.length > 254) return res.status(400).json({ error: 'El correo no es válido.' });
      updateData.email = email.trim().toLowerCase();
      const owner = updateData.email ? await findUserByEmail(db, updateData.email) : null;
      if (owner && owner.id !== targetUser.id) {
        return res.status(400).json({ error: 'Ese correo ya pertenece a otra cuenta.' });
      }
    }
    if (name !== undefined) {
      if (!isValidName(name)) return res.status(400).json({ error: NAME_ERROR });
      updateData.name = name.trim();
    }
    if (career !== undefined) {
      if (typeof career !== 'string' || career.length > 200) return res.status(400).json({ error: 'La carrera no es válida (máximo 200 caracteres).' });
      updateData.career = career.trim();
    }
    if (tutorType !== undefined && (typeof tutorType !== 'string' || tutorType.length > 40)) return res.status(400).json({ error: 'Tipo de tutor no válido.' });
    if (tutorTypes !== undefined && !(Array.isArray(tutorTypes) ? tutorTypes : [tutorTypes]).every(t => typeof t === 'string' && t.length <= 40)) return res.status(400).json({ error: 'Tipo de tutor no válido.' });
    if (assignedTutorIds !== undefined && !(Array.isArray(assignedTutorIds) && assignedTutorIds.length <= 500 && assignedTutorIds.every(t => typeof t === 'string' && t.length <= 100))) return res.status(400).json({ error: 'Lista de tutores no válida.' });
    if (tutorType !== undefined) updateData.tutorType = tutorType;
    if (tutorTypes !== undefined) updateData.tutorTypes = Array.isArray(tutorTypes) ? tutorTypes : [tutorTypes];
    // Mantener tutorType y tutorTypes sincronizados: si quedan distintos, el cambio de rol no se refleja en los portales.
    if (tutorType !== undefined && tutorTypes === undefined) updateData.tutorTypes = [tutorType];
    if (updateData.tutorTypes && updateData.tutorTypes.length > 0 && !updateData.tutorTypes.includes(updateData.tutorType)) {
      updateData.tutorType = updateData.tutorTypes.includes('tutor_de_tutores') ? 'tutor_de_tutores' : updateData.tutorTypes[0];
    }
    if (assignedTutorIds !== undefined) updateData.assignedTutorIds = assignedTutorIds;
    if (role !== undefined) updateData.role = role;
    if (roles !== undefined) updateData.roles = Array.isArray(roles) ? roles : [roles];
    
    if (rut !== undefined && (typeof rut !== 'string' || rut.length > 20)) return res.status(400).json({ error: RUT_ERROR });
    if (rut !== undefined && rut.trim()) {
      const cleanRut = rut.replace(/[\.\-]/g, '').trim();
      if (cleanRut.length !== 9) {
        return res.status(400).json({ error: "El RUT debe tener exactamente 9 dígitos/caracteres." });
      }
      if (!isValidRut(cleanRut)) return res.status(400).json({ error: RUT_ERROR });
      updateData.rut = encryptField(rut.trim());
      updateData.rutHash = hashRut(cleanRut);
      const rutOwner = await db.collection('users').findOne({ rutHash: updateData.rutHash }, { projection: { id: 1 } });
      if (rutOwner && rutOwner.id !== targetUser.id) {
        return res.status(400).json({ error: 'Ese RUT ya pertenece a otra cuenta.' });
      }
    }

    if (password !== undefined && typeof password !== 'string') return res.status(400).json({ error: 'La contraseña no es válida.' });
    if (password !== undefined && password.trim()) {
      // Solo un administrador fija una contraseña a mano; coordinación usa "enviar contraseña temporal" (así nadie conoce la clave de otra persona)
      if (!req.userRoles.includes('admin')) {
        return res.status(403).json({ error: 'Solo un administrador puede fijar una contraseña. Usa "enviar contraseña temporal" para que la persona reciba una por correo.' });
      }
      const policyError = validatePasswordPolicy(password, { rut: decryptField(targetUser.rut) || '', email: targetUser.email, name: targetUser.name });
      if (policyError) return res.status(400).json({ error: policyError });
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password.trim(), salt);
      updateData.initialPasswordExpiresAt = null; // una contraseña fijada por el administrador no vence
      sessionBump = true;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No hay datos para actualizar." });
    }

    const targetHash = hashRut(id);
    await db.collection('users').updateOne(
      { _id: targetUser._id },
      { $set: updateData, ...(sessionBump || (updateData.email && updateData.email !== (targetUser.email || '').toLowerCase()) ? { $inc: { sessionVersion: 1 } } : {}) }
    );
    await audit(req, 'user.update', { userId: targetUser.id }, { fields: Object.keys(updateData).filter(k => k !== 'password') });
    // Cambio de correo: se avisa al correo anterior (si alguien toma la cuenta cambiando el correo, el dueño se entera)
    if (updateData.email && targetUser.email && updateData.email !== targetUser.email.toLowerCase()) {
      sendEmail({
        to: targetUser.email, toName: targetUser.name,
        subject: 'Se cambió el correo de tu cuenta',
        text: 'El correo asociado a tu cuenta de Trayectoria UFT fue cambiado por coordinación. Si no esperabas este cambio, avisa a la Dirección de Trayectoria Estudiantil.'
      }).catch(err => console.warn('[Mail] No se pudo avisar el cambio de correo:', err.message));
    }

    const updatedUser = await db.collection('users').findOne({
      $or: [{ id }, { rutHash: targetHash }, { rut: id }]
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    const safeResult = sanitizeUserOutput(updatedUser);
    emitEvent('users:changed', { action: 'update', userId: id, user: safeResult });

    res.json({ success: true, user: safeResult });
  } catch (err) {
    sendServerError(res, err);
  }
};

export const deleteUser = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const targetUser = await findUserById(db, id);
    if (!targetUser) {
      return res.status(404).json({ error: "Usuario no encontrado para eliminar." });
    }
    if (rejectAdminChangeByNonAdmin(req, res, { targetUser })) return;

    const result = await db.collection('users').deleteOne({ _id: targetUser._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado para eliminar." });
    }

    // Quitarlo de las sesiones donde estaba inscrito (si no, queda como un inscrito fantasma que ocupa cupo)
    const affected = await db.collection('sessions').find({ $or: [{ studentIds: id }, { [`attendance.${id}`]: { $exists: true } }, { [`ratings.${id}`]: { $exists: true } }] }, { projection: { id: 1 } }).toArray();
    if (affected.length > 0) {
      await db.collection('sessions').updateMany(
        { id: { $in: affected.map(s => s.id) } },
        { $pull: { studentIds: id }, $unset: { [`attendance.${id}`]: '', [`ratings.${id}`]: '' } }
      );
      affected.forEach(s => emitEvent('sessions:changed', { action: 'update', sessionId: s.id }));
    }

    // Borrado completo de los datos personales de la cuenta (derecho de supresión, Ley 21.719)
    const emailRegex = targetUser.email ? new RegExp(`^${String(targetUser.email).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') : null;
    await Promise.all([
      db.collection('student_requests').deleteMany({ studentId: targetUser.id }),
      db.collection('availabilities').deleteMany({ userId: targetUser.id }),
      db.collection('password_resets').deleteMany({ userId: targetUser.id }),
      ...(emailRegex ? [db.collection('notifications').deleteMany({ toEmail: emailRegex })] : []),
    ]);
    await audit(req, 'user.delete', { userId: targetUser.id });
    emitEvent('users:changed', { action: 'delete', userId: id });

    res.json({ success: true, message: `Usuario ${id} eliminado exitosamente de MongoDB Atlas.` });
  } catch (err) {
    sendServerError(res, err);
  }
};

