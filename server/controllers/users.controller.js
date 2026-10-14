import bcrypt from 'bcrypt';
import { encryptField, hashRut, sanitizeUserOutput } from '../services/crypto.service.js';
import { emitEvent } from '../services/socket.service.js';
import { setSessionCookie } from '../services/session.service.js';
import { getUserRoles } from '../middlewares/auth.js';
import { sendServerError } from '../utils/errors.js';

const ALUMNO_EMAIL_DOMAINS = ['@uft.cl', '@mail.uft.cl', '@uft.edu'];

const includesAdmin = (role, roles) =>
  role === 'admin' || (Array.isArray(roles) ? roles.includes('admin') : roles === 'admin');

async function findUserById(db, id) {
  return db.collection('users').findOne({ $or: [{ id }, { rutHash: hashRut(id) }, { rut: id }] });
}

// Solo un administrador puede crear, editar o eliminar cuentas con rol admin, o asignar ese rol
function rejectAdminChangeByNonAdmin(req, res, { targetUser, role, roles } = {}) {
  if (req.userRoles.includes('admin')) return false;
  if (includesAdmin(role, roles) || getUserRoles(targetUser).includes('admin')) {
    res.status(403).json({ error: 'Solo un administrador puede gestionar cuentas o permisos de administrador.' });
    return true;
  }
  return false;
}

export const getUsers = async (req, res) => {
  const db = req.db;
  try {
    const users = await db.collection('users').find({}).toArray();
    const safeUsers = users.map(u => sanitizeUserOutput(u));
    res.json(safeUsers);
  } catch (err) {
    sendServerError(res, err);
  }
};

// Valida, hashea la contraseña, cifra el RUT e inserta. Devuelve { error } o { user } (sin datos sensibles)
async function insertUser(db, newUser) {
  // Validación de seguridad de RUT (exactamente 9 caracteres ignorando puntos y guión)
  const cleanRut = (newUser.rut || '').replace(/[\.\-]/g, '').trim();
  if (cleanRut.length !== 9) {
    return { error: "El RUT debe tener exactamente 9 dígitos/caracteres (ej: 123456789 o 12.345.678-9)." };
  }

  const rutBlindIndex = hashRut(cleanRut);

  // Verificar si ya existe un usuario con este RUT usando el Blind Index seguro
  const existing = await db.collection('users').findOne({ rutHash: rutBlindIndex });
  if (existing) {
    return { error: "El RUT ya se encuentra registrado en el sistema." };
  }

  if (newUser.password) {
    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(newUser.password, salt);
  }

  const plainRut = newUser.rut;
  // Cifrar el RUT en reposo antes de guardar en MongoDB Atlas
  newUser.rut = encryptField(plainRut);
  newUser.rutHash = rutBlindIndex;

  await db.collection('users').insertOne(newUser);
  
  const safeResult = sanitizeUserOutput({ ...newUser, rut: plainRut });
  emitEvent('users:changed', { action: 'create', user: safeResult });
  return { user: safeResult };
}

// Alta de usuarios desde los paneles de Docente y Administrador
export const createUser = async (req, res) => {
  try {
    const { _id, rutHash, ...newUser } = req.body || {};
    if (rejectAdminChangeByNonAdmin(req, res, { role: newUser.role, roles: newUser.roles })) return;
    if (!newUser.id) newUser.id = `${newUser.role || 'user'}_${Date.now()}`;

    const result = await insertUser(req.db, newUser);
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json(result.user);
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
    const cleanEmail = email.trim().toLowerCase();
    if (!ALUMNO_EMAIL_DOMAINS.some(d => cleanEmail.endsWith(d))) {
      return res.status(400).json({ error: 'El correo institucional debe tener dominio oficial de la universidad.' });
    }
    if (password.trim().length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const result = await insertUser(req.db, {
      id: `alumno_${Date.now()}`,
      name: name.trim(),
      rut: rut.trim(),
      role: 'alumno',
      roles: ['alumno'],
      email: cleanEmail,
      career: typeof career === 'string' ? career.trim() : '',
      password: password.trim()
    });
    if (result.error) return res.status(400).json({ error: result.error });

    setSessionCookie(res, result.user.id);
    res.status(201).json(result.user);
  } catch (err) {
    sendServerError(res, err);
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
    if (rejectAdminChangeByNonAdmin(req, res, { targetUser, role, roles })) return;

    const updateData = {};
    if (email !== undefined) updateData.email = email.trim().toLowerCase();
    if (name !== undefined) updateData.name = name.trim();
    if (career !== undefined) updateData.career = career.trim();
    if (tutorType !== undefined) updateData.tutorType = tutorType;
    if (tutorTypes !== undefined) updateData.tutorTypes = Array.isArray(tutorTypes) ? tutorTypes : [tutorTypes];
    if (assignedTutorIds !== undefined) updateData.assignedTutorIds = assignedTutorIds;
    if (role !== undefined) updateData.role = role;
    if (roles !== undefined) updateData.roles = Array.isArray(roles) ? roles : [roles];
    
    if (rut !== undefined && rut.trim()) {
      const cleanRut = rut.replace(/[\.\-]/g, '').trim();
      if (cleanRut.length !== 9) {
        return res.status(400).json({ error: "El RUT debe tener exactamente 9 dígitos/caracteres." });
      }
      updateData.rut = encryptField(rut.trim());
      updateData.rutHash = hashRut(cleanRut);
    }

    if (password !== undefined && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password.trim(), salt);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No hay datos para actualizar." });
    }

    const targetHash = hashRut(id);
    await db.collection('users').updateOne(
      { $or: [{ id }, { rutHash: targetHash }, { rut: id }] },
      { $set: updateData }
    );

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

    emitEvent('users:changed', { action: 'delete', userId: id });

    res.json({ success: true, message: `Usuario ${id} eliminado exitosamente de MongoDB Atlas.` });
  } catch (err) {
    sendServerError(res, err);
  }
};

