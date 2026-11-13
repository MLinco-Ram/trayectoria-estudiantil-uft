import { encryptField, decryptField } from '../services/crypto.service.js';
import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';
import { createAccountWithInitialPassword } from './users.controller.js';
// El RUT no se guarda: del RUT del Excel solo se toman sus últimos 4 caracteres (contraseña inicial),
// que se guardan cifrados hasta registrar la cuenta. Las cuentas creadas desde aquí entran con su correo.

// Usuarios importados (p. ej. desde Excel) que aún NO tienen cuenta: no reciben correo
// hasta que el administrador les asigna un rol y los registra.
const COLLECTION = 'pending_users';
const ROLES = ['alumno', 'tutor', 'docente'];
const TUTOR_TYPES = ['tutor_par', 'tutor_de_tutores'];
const MAX_IMPORT = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanRut = (rut) => String(rut || '').replace(/[.\-\s]/g, '').toUpperCase();
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const toOutput = (doc) => ({
  id: doc.id,
  name: doc.name,
  email: doc.email,
  career: doc.career || '',
  role: doc.role || null,
  tutorTypes: Array.isArray(doc.tutorTypes) ? doc.tutorTypes : [],
  createdAt: doc.createdAt,
});

const notifyChanged = () => emitEvent('pending_users:changed', {});

export const listPendingUsers = async (req, res) => {
  try {
    const docs = await req.db.collection(COLLECTION).find({}).sort({ createdAt: 1, name: 1 }).toArray();
    res.json(docs.map(toOutput));
  } catch (err) {
    sendServerError(res, err);
  }
};

// Importa filas { name, rut, email, career? }. Omite RUT inválidos, repetidos en el archivo,
// ya registrados como usuario o ya pendientes, e informa cada omisión.
export const importPendingUsers = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'No se recibieron filas para importar.' });
    if (rows.length > MAX_IMPORT) return res.status(400).json({ error: `Máximo ${MAX_IMPORT} filas por importación.` });

    const db = req.db;
    const skipped = [];
    const seen = new Set();
    const toInsert = [];
    const now = new Date().toISOString();

    for (const [index, row] of rows.entries()) {
      const name = str(row?.name);
      const email = str(row?.email).toLowerCase();
      const rut = cleanRut(row?.rut);
      const label = name || rut || `Fila ${index + 2}`;

      if (!name) { skipped.push({ label, reason: 'Falta el nombre.' }); continue; }
      if (rut.length !== 9) { skipped.push({ label, reason: 'RUT inválido (debe tener 9 caracteres con dígito verificador).' }); continue; }
      if (!EMAIL_RE.test(email)) { skipped.push({ label, reason: 'Correo inválido.' }); continue; }

      if (seen.has(email)) { skipped.push({ label, reason: 'Correo repetido en el archivo.' }); continue; }
      seen.add(email);

      toInsert.push({
        id: `pending_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        initialPassword: encryptField(rut.slice(-4)),
        email,
        career: str(row?.career),
        // Rol opcional (alta manual); desde Excel llega vacío y se asigna después
        role: ROLES.includes(row?.role) ? row.role : null,
        tutorTypes: row?.role === 'tutor'
          ? ((Array.isArray(row.tutorTypes) ? row.tutorTypes.filter(t => TUTOR_TYPES.includes(t)) : []).length
              ? row.tutorTypes.filter(t => TUTOR_TYPES.includes(t))
              : ['tutor_par'])
          : [],
        createdAt: now,
      });
    }

    const emails = toInsert.map(d => d.email);
    const [existingUsers, existingPending] = await Promise.all([
      db.collection('users').find({ email: { $exists: true } }, { projection: { email: 1 } }).toArray(),
      db.collection(COLLECTION).find({ email: { $in: emails } }, { projection: { email: 1 } }).toArray(),
    ]);
    const userEmails = new Set(existingUsers.map(u => String(u.email || '').toLowerCase()));
    const pendingEmails = new Set(existingPending.map(u => u.email));

    const fresh = toInsert.filter(d => {
      if (userEmails.has(d.email)) { skipped.push({ label: d.name, reason: 'Ya tiene cuenta en el sistema.' }); return false; }
      if (pendingEmails.has(d.email)) { skipped.push({ label: d.name, reason: 'Ya estaba en pendientes.' }); return false; }
      return true;
    });

    if (fresh.length > 0) {
      await db.collection(COLLECTION).insertMany(fresh);
      notifyChanged();
    }
    res.status(201).json({ added: fresh.length, skipped });
  } catch (err) {
    sendServerError(res, err);
  }
};

// Edita rol, subroles de tutor, carrera, nombre o correo de uno o varios pendientes (ids[]).
export const updatePendingUsers = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(id => typeof id === 'string') : [];
    if (ids.length === 0) return res.status(400).json({ error: 'No se indicaron usuarios.' });

    const { role, tutorTypes, career, name, email } = req.body;
    const update = {};
    if (role !== undefined) {
      if (role !== null && !ROLES.includes(role)) return res.status(400).json({ error: 'Rol no válido.' });
      update.role = role;
      if (role !== 'tutor') update.tutorTypes = [];
      else if (tutorTypes === undefined) update.tutorTypes = ['tutor_par'];
    }
    if (tutorTypes !== undefined) {
      const types = Array.isArray(tutorTypes) ? tutorTypes.filter(t => TUTOR_TYPES.includes(t)) : [];
      if (types.length === 0) return res.status(400).json({ error: 'Selecciona al menos un subrol de tutor.' });
      update.tutorTypes = types;
    }
    if (career !== undefined) update.career = str(career);
    if (ids.length === 1 && name !== undefined) {
      if (!str(name)) return res.status(400).json({ error: 'El nombre es obligatorio.' });
      update.name = str(name);
    }
    if (ids.length === 1 && email !== undefined) {
      const clean = str(email).toLowerCase();
      if (!EMAIL_RE.test(clean)) return res.status(400).json({ error: 'Correo inválido.' });
      update.email = clean;
    }
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'No hay cambios que guardar.' });

    const result = await req.db.collection(COLLECTION).updateMany({ id: { $in: ids } }, { $set: update });
    notifyChanged();
    res.json({ updated: result.modifiedCount });
  } catch (err) {
    sendServerError(res, err);
  }
};

export const deletePendingUsers = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(id => typeof id === 'string') : [];
    if (ids.length === 0) return res.status(400).json({ error: 'No se indicaron usuarios.' });
    const result = await req.db.collection(COLLECTION).deleteMany({ id: { $in: ids } });
    notifyChanged();
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    sendServerError(res, err);
  }
};

// Crea las cuentas de los pendientes indicados (deben tener rol), les envía la contraseña
// por correo y los quita de pendientes. Los que fallan se quedan pendientes con el motivo.
export const registerPendingUsers = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(id => typeof id === 'string') : [];
    if (ids.length === 0) return res.status(400).json({ error: 'No se indicaron usuarios.' });
    if (ids.length > 200) return res.status(400).json({ error: 'Registra como máximo 200 usuarios a la vez.' });

    const db = req.db;
    const docs = await db.collection(COLLECTION).find({ id: { $in: ids } }).toArray();
    const registered = [];
    const failed = [];

    // En serie: evita saturar el SMTP y mantiene el orden de los correos
    for (const doc of docs) {
      if (!ROLES.includes(doc.role)) {
        failed.push({ id: doc.id, name: doc.name, reason: 'Sin rol asignado.' });
        continue;
      }
      const isTutor = doc.role === 'tutor';
      const tutorTypes = isTutor ? (doc.tutorTypes?.length ? doc.tutorTypes : ['tutor_par']) : undefined;
      // Pendientes antiguos guardaban el RUT cifrado: se usa solo para obtener los 4 caracteres
      const initialPassword = doc.initialPassword
        ? decryptField(doc.initialPassword)
        : cleanRut(decryptField(doc.rut) || doc.rut).slice(-4);
      if (!initialPassword || initialPassword.length !== 4) {
        failed.push({ id: doc.id, name: doc.name, reason: 'No hay contraseña inicial (falta el RUT de origen).' });
        continue;
      }
      const result = await createAccountWithInitialPassword(db, {
        name: doc.name,
        email: doc.email,
        role: doc.role,
        roles: [doc.role],
        career: doc.career || (doc.role === 'docente' ? 'Coordinación Docente' : ''),
        ...(isTutor ? { tutorType: tutorTypes[0], tutorTypes, assignedTutorIds: tutorTypes.includes('tutor_de_tutores') ? [] : undefined } : {}),
      }, initialPassword);
      if (result.error) {
        failed.push({ id: doc.id, name: doc.name, reason: result.error });
        continue;
      }
      await db.collection(COLLECTION).deleteOne({ _id: doc._id });
      registered.push({ id: doc.id, name: doc.name, emailSent: result.emailSent });
    }

    notifyChanged();
    res.json({ registered, failed });
  } catch (err) {
    sendServerError(res, err);
  }
};
