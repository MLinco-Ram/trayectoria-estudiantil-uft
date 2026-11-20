import crypto from 'crypto';
import { requireEnv } from '../config/env.js';
import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';
import { normalizeRoomCode } from './rooms.controller.js';
import { isTutorOrStaff, isStaff } from '../middlewares/auth.js';
import { hasSafeKeys } from '../utils/validate.js';
import { audit } from '../services/audit.service.js';

// Igual que MAX_WEEKLY_ACTIVE_BOOKINGS de src/data.ts
const MAX_WEEKLY_ACTIVE_BOOKINGS = 5;

// Un alumno no debe ver quiénes más están inscritos ni sus asistencias o encuestas:
// los demás inscritos se reemplazan por marcadores (se conserva la cantidad para mostrar cupos)
const maskSessionForStudent = (session, studentId) => {
  if (!session) return session;
  const studentIds = (session.studentIds || []).map((sid, i) => (sid === studentId ? sid : `otro_${i}`));
  const own = (obj) => (obj && obj[studentId] !== undefined ? { [studentId]: obj[studentId] } : {});
  // Una tutoría 1 a 1 reservada para otra persona no revela para quién (queda un marcador)
  const reserved = session.reservedForStudentId && session.reservedForStudentId !== studentId ? { reservedForStudentId: 'otro' } : {};
  return { ...session, studentIds, ...reserved, attendance: own(session.attendance), ratings: own(session.ratings) };
};

const sessionForRequester = (req, session) => (isTutorOrStaff(req) ? session : maskSessionForStudent(session, req.user?.id));

// Lunes (YYYY-MM-DD) de la semana de una fecha, igual que getWeekKey de src/data.ts
const getWeekKey = (dateStr = '') => {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

// true si la sesión ya terminó (fecha pasada, o hoy y ya pasó su hora de término), en hora de Chile
const hasSessionEnded = (session) => {
  const now = nowInSantiago();
  if (!session?.date || session.date < now.date) return true;
  if (session.date > now.date) return false;
  const range = parseSlotRange(session.timeSlot);
  return range ? now.minutes >= range[1] : false;
};

// Reglas de las sesiones 1 a 1 (canStudentAccessSession de src/data.ts). Devuelve un mensaje de error o null.
const checkPersonalizedAccess = async (db, session, studentId) => {
  const isPersonalized = session.type === 'tutoria_personalizada' || session.type === 'psico_asesoria_individual' || session.maxSpots === 1;
  if (!isPersonalized) return null;
  const isAssigned = (session.studentIds || []).includes(studentId) || session.reservedForStudentId === studentId;
  const isOpenSlot = !session.reservedForStudentId && (session.studentIds || []).length === 0;
  if (!isAssigned && !isOpenSlot) return 'Esta tutoría es personalizada y está asignada exclusivamente a otro estudiante.';
  if (!isAssigned && session.offerGroupId) {
    const sibling = await db.collection('sessions').findOne({ offerGroupId: session.offerGroupId, id: { $ne: session.id }, studentIds: studentId });
    if (sibling) return 'Ya tomaste otro de los horarios ofrecidos para esta sesión.';
  }
  return null;
};

// Reservas activas del estudiante en la semana de `date` (getStudentActiveBookingsInWeek de src/data.ts)
const countActiveBookingsInWeek = async (db, studentId, date, excludeId) => {
  const weekKey = getWeekKey(date);
  const mine = await db.collection('sessions')
    .find({ studentIds: studentId, isCompleted: { $ne: true }, id: { $ne: excludeId } }, { projection: { date: 1, timeSlot: 1, attendance: 1 } })
    .toArray();
  return mine.filter(s => {
    const mark = s.attendance?.[studentId];
    return mark !== 'presente' && mark !== 'ausente' && !hasSessionEnded(s) && getWeekKey(s.date) === weekKey;
  }).length;
};

// Condición atómica de "queda cupo": la cantidad de inscritos es menor que maxSpots
const hasFreeSpotExpr = { $lt: [{ $size: { $ifNull: ['$studentIds', []] } }, { $ifNull: ['$maxSpots', 1000000] }] };

// Una oferta de varios horarios (offerGroupId) es para un solo estudiante: cuando alguien toma uno,
// los demás horarios sin inscritos se eliminan para liberar al tutor
const releaseOfferGroup = async (db, session) => {
  if (!session?.offerGroupId || !(session.studentIds || []).length) return;
  const filter = { offerGroupId: session.offerGroupId, id: { $ne: session.id }, studentIds: { $size: 0 } };
  const released = await db.collection('sessions').find(filter, { projection: { id: 1 } }).toArray();
  if (released.length === 0) return;
  await db.collection('sessions').deleteMany({ id: { $in: released.map(r => r.id) } });
  released.forEach(r => emitEvent('sessions:changed', { action: 'delete', sessionId: r.id }));
};

// "8:30 - 9:40" -> [510, 580] en minutos; null si no tiene ese formato
const parseSlotRange = (timeSlot = '') => {
  const m = timeSlot.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
};

// Horas de anticipación con que cierra la autoinscripción (0 = hasta el inicio). Debe coincidir con
// REGISTRATION_CLOSE_HOURS_BEFORE de src/data.ts.
const REGISTRATION_CLOSE_HOURS_BEFORE = 0;

// Fecha (YYYY-MM-DD) y minutos del día actuales en hora de Chile (el servidor puede correr en UTC)
const nowInSantiago = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};

// true si la sesión ya comenzó (o falta menos del margen configurado) o su fecha ya pasó
const isRegistrationClosed = (session) => {
  if (!session?.date) return true;
  const now = nowInSantiago();
  if (session.date < now.date) return true;
  if (session.date > now.date) return false;
  const start = String(session.timeSlot || '').match(/^(\d{1,2}):(\d{2})/);
  if (!start) return false;
  const startMinutes = Number(start[1]) * 60 + Number(start[2]);
  return now.minutes >= startMinutes - REGISTRATION_CLOSE_HOURS_BEFORE * 60;
};

// Una sala no puede tener dos sesiones activas que se crucen en la misma fecha
const findRoomConflict = async (db, session) => {
  const room = String(session.location || '').trim();
  const sameDay = await db.collection('sessions')
    .find({ date: session.date, location: room, isCompleted: { $ne: true }, id: { $ne: session.id } })
    .toArray();
  const range = parseSlotRange(session.timeSlot);
  return sameDay.find(s => {
    const other = parseSlotRange(s.timeSlot);
    if (!range || !other) return s.timeSlot === session.timeSlot;
    return range[0] < other[1] && other[0] < range[1];
  });
};

// Para no descargar años de historial en cada carga del panel (LO-02), alumnos y tutores reciben las sesiones desde
// hace 120 días en adelante más todas en las que participan (su historial). Coordinación recibe todo (calendario y analítica).
const HISTORY_DAYS = 120;
export const getSessions = async (req, res) => {
  const db = req.db;
  try {
    let filter = {};
    if (!isStaff(req)) {
      const cutoff = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      filter = { $or: [{ date: { $gte: cutoff } }, { studentIds: req.user.id }, { tutorId: req.user.id }, { reservedForStudentId: req.user.id }] };
    }
    const sessions = await db.collection('sessions').find(filter).toArray();
    res.json(sessions.map(s => sessionForRequester(req, s)));
  } catch (err) {
    sendServerError(res, err);
  }
};

// Fecha real (AAAA-MM-DD), horario "HH:MM - HH:MM" válido y cupo entero positivo (SE-04)
const TIME_SLOT = /^([01]?\d|2[0-3]):[0-5]\d\s*-\s*([01]?\d|2[0-3]):[0-5]\d$/;
const isRealDate = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const validateSessionFields = (s, { requireAll = false } = {}) => {
  if ((requireAll || s.date !== undefined) && !isRealDate(s.date)) return 'La fecha debe tener el formato AAAA-MM-DD y ser una fecha real.';
  if ((requireAll || s.timeSlot !== undefined) && !(typeof s.timeSlot === 'string' && TIME_SLOT.test(s.timeSlot))) return 'El horario debe tener el formato HH:MM - HH:MM.';
  if (s.maxSpots !== undefined && !(Number.isInteger(s.maxSpots) && s.maxSpots >= 1 && s.maxSpots <= 1000)) return 'El cupo debe ser un número entero entre 1 y 1000.';
  if ((requireAll || s.title !== undefined) && !(typeof s.title === 'string' && s.title.trim().length >= 1 && s.title.length <= 200)) return 'El título es obligatorio (máximo 200 caracteres).';
  if (s.syllabus !== undefined && (typeof s.syllabus !== 'string' || s.syllabus.length > 10000)) return 'El temario es demasiado largo.';
  return null;
};

// Encuesta del alumno: notas en 1-5, textos acotados (SE-11)
const validateRating = (r) => {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 'La encuesta no es válida.';
  const inScale = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 5;
  if (!inScale(r.rating)) return 'La nota debe estar entre 1 y 5.';
  if (r.answers !== undefined) {
    if (!r.answers || typeof r.answers !== 'object' || Array.isArray(r.answers) || Object.keys(r.answers).length > 30 || !Object.values(r.answers).every(inScale)) return 'Las respuestas de la encuesta no son válidas.';
  }
  for (const k of ['comment', 'mostUseful', 'additionalSupport', 'relatorPositive', 'relatorImprove']) {
    if (r[k] !== undefined && (typeof r[k] !== 'string' || r[k].length > 1000)) return 'Los comentarios de la encuesta pueden tener hasta 1.000 caracteres.';
  }
  return null;
};

export const createSession = async (req, res) => {
  const db = req.db;
  try {
    if (!hasSafeKeys(req.body) || typeof req.body.location !== 'string') {
      return res.status(400).json({ error: 'Los datos de la sesión no son válidos.' });
    }
    const newSession = { ...req.body };
    delete newSession._id;
    const invalid = validateSessionFields(newSession, { requireAll: true });
    if (invalid) return res.status(400).json({ error: invalid });
    // El id nunca puede repetirse: si falta o ya existe, el servidor asigna uno aleatorio
    if (typeof newSession.id !== 'string' || !newSession.id || newSession.id.length > 100
        || await db.collection('sessions').findOne({ id: newSession.id }, { projection: { _id: 1 } })) {
      newSession.id = `session_${crypto.randomUUID()}`;
    }
    newSession.location = normalizeRoomCode(newSession.location);
    if (!(await db.collection('rooms').findOne({ code: newSession.location }))) {
      return res.status(400).json({ error: `La sala "${newSession.location}" no está registrada. Agrégala en "Salas".` });
    }
    const conflict = await findRoomConflict(db, newSession);
    if (conflict) {
      return res.status(409).json({ error: `La sala ${newSession.location} ya está ocupada el ${newSession.date} (${conflict.timeSlot}) por "${conflict.title}".` });
    }
    await db.collection('sessions').insertOne(newSession);
    await audit(req, 'session.create', { sessionId: newSession.id });
    
    // Notificar en tiempo real a todos los clientes
    emitEvent('sessions:changed', { action: 'create', session: newSession });
    
    res.status(201).json(newSession);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const updateSession = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    if (!hasSafeKeys(req.body)) {
      return res.status(400).json({ error: 'Los datos de la sesión no son válidos.' });
    }
    const updateData = { ...req.body };
    delete updateData._id; // Evitar modificar _id immutable de Mongo
    delete updateData.id;

    // Un alumno solo puede guardar su propia encuesta, y solo en una sesión donde está inscrito.
    // Inscribirse y cancelar van por /enroll, que valida cupo y límite semanal de forma atómica.
    if (!isTutorOrStaff(req)) {
      const ownRatingKey = `ratings.${req.user.id}`;
      const keys = Object.keys(updateData);
      if (keys.length !== 1 || keys[0] !== ownRatingKey) {
        return res.status(403).json({ error: 'No tienes permisos para modificar esta sesión.' });
      }
      const ratingError = validateRating(updateData[ownRatingKey]);
      if (ratingError) return res.status(400).json({ error: ratingError });
      const enrolled = await db.collection('sessions').findOne({ id, studentIds: req.user.id }, { projection: { _id: 1 } });
      if (!enrolled) return res.status(403).json({ error: 'Solo puedes evaluar sesiones en las que estás inscrito.' });
      const r = updateData[ownRatingKey];
      const clean = { studentId: req.user.id, studentName: req.user.name, rating: r.rating, comment: r.comment || '', createdAt: new Date().toISOString() };
      for (const k of ['answers', 'surveyKind', 'mostUseful', 'additionalSupport', 'relatorPositive', 'relatorImprove']) if (r[k] !== undefined) clean[k] = r[k];
      await db.collection('sessions').updateOne({ id }, { $set: { [ownRatingKey]: clean } });
      const updated = await db.collection('sessions').findOne({ id });
      emitEvent('sessions:changed', { action: 'update', sessionId: id, session: updated });
      return res.json({ success: true });
    }

    const fieldError = validateSessionFields(updateData);
    if (fieldError) return res.status(400).json({ error: fieldError });

    // Un tutor solo modifica sus propias sesiones y solo estos campos: asistencia, inscritos, cierre y temario.
    // (Coordinación puede editar cualquier campo salvo id.) Evita que un tutor altere sesiones ajenas.
    if (!isStaff(req)) {
      const own = await db.collection('sessions').findOne({ id }, { projection: { tutorId: 1 } });
      if (!own) return res.status(404).json({ error: 'La sesión no existe.' });
      const supervises = Array.isArray(req.user.assignedTutorIds) && req.user.assignedTutorIds.includes(own.tutorId);
      if (own.tutorId !== req.user.id && !supervises) {
        return res.status(403).json({ error: 'Solo puedes modificar tus propias sesiones o las de los tutores que supervisas.' });
      }
      const TUTOR_FIELDS = /^(attendance(\..+)?|studentIds|isCompleted|syllabus)$/;
      if (!Object.keys(updateData).every(k => TUTOR_FIELDS.test(k))) {
        return res.status(403).json({ error: 'No tienes permisos para modificar esos campos de la sesión.' });
      }
    }

    // Autoinscripción: si quien llama se agrega a sí mismo, la sesión no debe haber comenzado
    if (Array.isArray(updateData.studentIds) && updateData.studentIds.includes(req.user?.id)) {
      const current = await db.collection('sessions').findOne({ id });
      if (!current) return res.status(404).json({ error: 'La sesión no existe.' });
      const alreadyEnrolled = (current.studentIds || []).includes(req.user.id);
      if (!alreadyEnrolled && isRegistrationClosed(current)) {
        return res.status(400).json({ error: 'Plazo de inscripción cerrado: esta sesión ya comenzó.' });
      }
    }

    await db.collection('sessions').updateOne({ id }, { $set: updateData });
    await audit(req, 'session.update', { sessionId: id }, { fields: Object.keys(updateData).slice(0, 20) });
    
    const updatedFullSession = await db.collection('sessions').findOne({ id });
    await releaseOfferGroup(db, updatedFullSession);

    // Notificar en tiempo real a todos los clientes
    emitEvent('sessions:changed', { action: 'update', sessionId: id, session: updatedFullSession || updateData });
    
    res.json({ success: true, updated: updateData });
  } catch (err) {
    sendServerError(res, err);
  }
};

export const deleteSession = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    await db.collection('sessions').deleteOne({ id });
    await audit(req, 'session.delete', { sessionId: id });
    
    // Notificar en tiempo real a todos los clientes
    emitEvent('sessions:changed', { action: 'delete', sessionId: id });
    
    res.json({ success: true, message: `Sesión ${id} eliminada.` });
  } catch (err) {
    sendServerError(res, err);
  }
};

// POST /api/sessions/:id/enroll — el usuario en sesión se inscribe. Cupo, límite semanal y plazo se
// validan en el servidor y la escritura es atómica ($push condicionado), así dos alumnos que reservan
// a la vez no se pisan ni se supera el cupo.
export const enrollSession = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const studentId = req.user.id;
    const session = await db.collection('sessions').findOne({ id });
    if (!session) return res.status(404).json({ error: 'La sesión no existe.' });
    if ((session.studentIds || []).includes(studentId)) {
      return res.json({ success: true, alreadyEnrolled: true, session: sessionForRequester(req, session) });
    }
    if (session.isCompleted || hasSessionEnded(session)) {
      return res.status(400).json({ error: 'Esta sesión ya finalizó y no admite inscripciones.' });
    }
    if (isRegistrationClosed(session)) {
      return res.status(400).json({ error: 'Plazo de inscripción cerrado: esta sesión ya comenzó.' });
    }
    const accessError = await checkPersonalizedAccess(db, session, studentId);
    if (accessError) return res.status(403).json({ error: accessError });

    const active = await countActiveBookingsInWeek(db, studentId, session.date, id);
    if (active >= MAX_WEEKLY_ACTIVE_BOOKINGS) {
      return res.status(409).json({ error: `Límite semanal alcanzado: ya tienes ${active} de ${MAX_WEEKLY_ACTIVE_BOOKINGS} reservas activas esta semana.` });
    }

    const result = await db.collection('sessions').findOneAndUpdate(
      { id, studentIds: { $ne: studentId }, isCompleted: { $ne: true }, $expr: hasFreeSpotExpr },
      { $push: { studentIds: studentId }, $set: { [`attendance.${studentId}`]: 'pendiente' } },
      { returnDocument: 'after' }
    );
    const updated = result?.value !== undefined ? result.value : result;
    if (!updated) {
      const current = await db.collection('sessions').findOne({ id });
      if ((current?.studentIds || []).includes(studentId)) {
        return res.json({ success: true, alreadyEnrolled: true, session: sessionForRequester(req, current) });
      }
      return res.status(409).json({ error: 'Esta sesión ya no tiene cupos disponibles.' });
    }

    // Límite semanal a prueba de reservas simultáneas (SE-07): con la inscripción ya escrita se vuelve a contar y, si
    // se superó el tope, se deshace. Así, aunque lleguen 8 reservas a la vez, nunca quedan más de 5 activas.
    const activeNow = await countActiveBookingsInWeek(db, studentId, session.date, id);
    if (activeNow >= MAX_WEEKLY_ACTIVE_BOOKINGS) {
      await db.collection('sessions').updateOne({ id }, { $pull: { studentIds: studentId }, $unset: { [`attendance.${studentId}`]: '' } });
      return res.status(409).json({ error: `Límite semanal alcanzado: ya tienes ${activeNow} de ${MAX_WEEKLY_ACTIVE_BOOKINGS} reservas activas esta semana.` });
    }

    await releaseOfferGroup(db, updated);
    emitEvent('sessions:changed', { action: 'update', sessionId: id, session: updated });
    res.json({ success: true, session: sessionForRequester(req, updated) });
  } catch (err) {
    sendServerError(res, err);
  }
};

// DELETE /api/sessions/:id/enroll — el usuario en sesión cancela solo su propia reserva
export const unenrollSession = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const studentId = req.user.id;
    const result = await db.collection('sessions').findOneAndUpdate(
      { id },
      { $pull: { studentIds: studentId }, $unset: { [`attendance.${studentId}`]: '' } },
      { returnDocument: 'after' }
    );
    const updated = result?.value !== undefined ? result.value : result;
    if (!updated) return res.status(404).json({ error: 'La sesión no existe.' });
    emitEvent('sessions:changed', { action: 'update', sessionId: id, session: updated });
    res.json({ success: true, session: sessionForRequester(req, updated) });
  } catch (err) {
    sendServerError(res, err);
  }
};

// QR y PIN dinámicos (A-04): cambian cada ATTENDANCE_WINDOW_MS y se firman con HMAC_SECRET. Una captura del QR
// o un PIN compartido por WhatsApp dejan de servir en ~1,5 minutos, así que la asistencia exige estar en la sala.
// Se acepta la ventana actual y la anterior para absorber el retraso entre mostrar y escanear.
const ATTENDANCE_WINDOW_MS = 45 * 1000;
const attendanceSecret = () => requireEnv('HMAC_SECRET');
const currentWindow = (now = Date.now()) => Math.floor(now / ATTENDANCE_WINDOW_MS);
const hmac = (label, sessionId, win) => crypto.createHmac('sha256', attendanceSecret()).update(`${label}:${sessionId}:${win}`).digest();

const attendancePinFor = (sessionId, win) => String(hmac('pin', sessionId, win).readUInt32BE(0) % 1000000).padStart(6, '0');
const attendanceSigFor = (sessionId, win) => hmac('qr', sessionId, win).toString('base64url').slice(0, 16);
const attendanceQrFor = (sessionId, win) => `${sessionId}~${win}~${attendanceSigFor(sessionId, win)}`;

const validWindows = (now = Date.now()) => [currentWindow(now), currentWindow(now) - 1];

// Verifica un QR "<idSesion>~<ventana>~<firma>". Devuelve true solo si la firma es correcta y la ventana está vigente.
export const verifyAttendanceQr = (sessionId, token, now = Date.now()) => {
  const parts = typeof token === 'string' ? token.split('~') : [];
  if (parts.length !== 3 || parts[0] !== sessionId) return false;
  const win = Number(parts[1]);
  if (!Number.isInteger(win) || !validWindows(now).includes(win)) return false;
  const expected = Buffer.from(attendanceSigFor(sessionId, win));
  const received = Buffer.from(parts[2]);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

export const matchesAttendancePin = (sessionId, pin, now = Date.now()) => validWindows(now).some(w => attendancePinFor(sessionId, w) === pin);

// GET /api/sessions/:id/attendance-pin — tutores y coordinación (el modal del proyector la consulta cada pocos segundos)
export const getAttendancePin = async (req, res) => {
  try {
    const session = await req.db.collection('sessions').findOne({ id: req.params.id }, { projection: { id: 1, tutorId: 1 } });
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (!isStaff(req) && session.tutorId !== req.user.id && !(Array.isArray(req.user.assignedTutorIds) && req.user.assignedTutorIds.includes(session.tutorId))) {
      return res.status(403).json({ error: 'Solo el tutor de la sesión o coordinación pueden ver el código de asistencia.' });
    }
    const win = currentWindow();
    const expiresInMs = (win + 1) * ATTENDANCE_WINDOW_MS - Date.now();
    res.json({ pin: attendancePinFor(session.id, win), qr: attendanceQrFor(session.id, win), expiresInMs });
  } catch (err) {
    sendServerError(res, err);
  }
};

// POST /api/sessions/attendance-pin { pin } — el alumno marca asistencia con el PIN. Se busca entre
// las sesiones de hoy en las que está inscrito, y luego sigue el mismo camino que el QR.
export const registerPinAttendance = async (req, res, next) => {
  try {
    const pin = String(req.body?.pin || '').replace(/\D/g, '');
    if (pin.length !== 6) return res.status(400).json({ error: 'El PIN tiene 6 dígitos.' });
    const today = nowInSantiago().date;
    const candidates = await req.db.collection('sessions')
      .find({ date: today, studentIds: req.user.id }, { projection: { id: 1 } })
      .toArray();
    const match = candidates.find(s => matchesAttendancePin(s.id, pin));
    if (!match) return res.status(404).json({ error: 'PIN incorrecto o vencido, o no estás inscrito en una sesión de hoy con ese PIN.' });
    req.params.id = match.id;
    req.body = { verified: true };
    req.attendanceVerified = true;
    return registerQRAttendance(req, res, next);
  } catch (err) {
    sendServerError(res, err);
  }
};

// La asistencia solo se puede registrar el mismo día de la clase (hora de Chile; el servidor corre en UTC)
const hasAttendanceOpened = (session) => {
  if (!session?.date) return false;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return session.date === today;
};

// Ventana en la que un alumno puede marcar asistencia: desde 30 min antes del inicio hasta 30 min después del término (SE-14).
// Tutores y coordinación no tienen esta restricción (pueden corregir la lista después).
const ATTENDANCE_BEFORE_MIN = 30;
const ATTENDANCE_AFTER_MIN = 30;
const isInsideAttendanceWindow = (session) => {
  const range = parseSlotRange(session?.timeSlot);
  if (!range) return true; // sin horario interpretable no se puede acotar
  const { minutes } = nowInSantiago();
  return minutes >= range[0] - ATTENDANCE_BEFORE_MIN && minutes <= range[1] + ATTENDANCE_AFTER_MIN;
};

export const registerQRAttendance = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    // Un alumno solo registra su propia asistencia; tutores y coordinación pueden indicar a otro
    const studentId = isTutorOrStaff(req) ? (req.body?.studentId || req.user.id) : req.user.id;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId es requerido' });
    }

    const session = await db.collection('sessions').findOne({ id });
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    // El alumno debe presentar el QR vigente (o haber pasado por el PIN vigente); tutores y coordinación marcan sin código
    if (!isTutorOrStaff(req) && !req.attendanceVerified && !verifyAttendanceQr(id, req.body?.token)) {
      return res.status(400).json({ error: 'El código QR venció o no es válido. Escanea de nuevo el que se muestra en la sala.' });
    }

    if (!hasAttendanceOpened(session)) {
      return res.status(400).json({ error: 'La asistencia solo se puede registrar el día de la clase.' });
    }

    if (!isTutorOrStaff(req) && !isInsideAttendanceWindow(session)) {
      return res.status(400).json({ error: `La asistencia solo se puede marcar entre ${ATTENDANCE_BEFORE_MIN} minutos antes del inicio y ${ATTENDANCE_AFTER_MIN} minutos después del término de la clase.` });
    }

    // Las sesiones personalizadas (1 a 1) solo admiten al estudiante para quien fueron creadas
    // (o a cualquiera si se crearon sin estudiante y aún nadie las tomó)
    const accessError = await checkPersonalizedAccess(db, session, studentId);
    if (accessError) return res.status(403).json({ error: accessError });

    const wasAlreadyPresent = session.attendance?.[studentId] === 'presente';
    const isEnrolled = (session.studentIds || []).includes(studentId);

    // El QR solo confirma la asistencia de quien tiene reserva. Si alguien llega sin inscribirse,
    // el tutor lo agrega desde "Pasar lista" (+ Agregar Alumno).
    if (!isEnrolled && !isTutorOrStaff(req)) {
      return res.status(403).json({ error: `No estás inscrito en "${session.title}". Inscríbete antes de la clase o pide a tu tutor que te agregue a la lista.` });
    }

    if (isEnrolled) {
      await db.collection('sessions').updateOne({ id }, { $set: { [`attendance.${studentId}`]: 'presente' } });
    } else {
      // Quien llega sin reserva queda inscrito solo si aún hay cupo (escritura atómica)
      const added = await db.collection('sessions').updateOne(
        { id, studentIds: { $ne: studentId }, $expr: hasFreeSpotExpr },
        { $push: { studentIds: studentId }, $set: { [`attendance.${studentId}`]: 'presente' } }
      );
      if (added.matchedCount === 0) {
        const current = await db.collection('sessions').findOne({ id }, { projection: { studentIds: 1 } });
        if ((current?.studentIds || []).includes(studentId)) {
          await db.collection('sessions').updateOne({ id }, { $set: { [`attendance.${studentId}`]: 'presente' } });
        } else {
          return res.status(409).json({ error: 'La sesión no tiene cupos y no estabas inscrito. Pide al tutor que te agregue a la lista.' });
        }
      }
    }

    const updatedSession = await db.collection('sessions').findOne({ id });
    await releaseOfferGroup(db, updatedSession);
    emitEvent('sessions:changed', { action: 'update', sessionId: id, session: updatedSession });

    res.json({
      success: true,
      alreadyPresent: wasAlreadyPresent,
      session: sessionForRequester(req, updatedSession),
      message: wasAlreadyPresent 
        ? '¡Ya te encontrabas registrado como presente en esta tutoría!' 
        : '¡Asistencia registrada con éxito!' 
    });
  } catch (err) {
    sendServerError(res, err);
  }
};

