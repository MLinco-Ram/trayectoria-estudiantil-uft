import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';
import { normalizeRoomCode } from './rooms.controller.js';
import { isTutorOrStaff } from '../middlewares/auth.js';

// Igual que MAX_WEEKLY_ACTIVE_BOOKINGS de src/data.ts
const MAX_WEEKLY_ACTIVE_BOOKINGS = 5;

// Un alumno no debe ver quiénes más están inscritos ni sus asistencias o encuestas:
// los demás inscritos se reemplazan por marcadores (se conserva la cantidad para mostrar cupos)
const maskSessionForStudent = (session, studentId) => {
  if (!session) return session;
  const studentIds = (session.studentIds || []).map((sid, i) => (sid === studentId ? sid : `otro_${i}`));
  const own = (obj) => (obj && obj[studentId] !== undefined ? { [studentId]: obj[studentId] } : {});
  return { ...session, studentIds, attendance: own(session.attendance), ratings: own(session.ratings) };
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

export const getSessions = async (req, res) => {
  const db = req.db;
  try {
    const sessions = await db.collection('sessions').find({}).toArray();
    res.json(sessions.map(s => sessionForRequester(req, s)));
  } catch (err) {
    sendServerError(res, err);
  }
};

export const createSession = async (req, res) => {
  const db = req.db;
  try {
    const newSession = req.body;
    newSession.location = normalizeRoomCode(newSession.location);
    if (!(await db.collection('rooms').findOne({ code: newSession.location }))) {
      return res.status(400).json({ error: `La sala "${newSession.location}" no está registrada. Agrégala en "Salas".` });
    }
    const conflict = await findRoomConflict(db, newSession);
    if (conflict) {
      return res.status(409).json({ error: `La sala ${newSession.location} ya está ocupada el ${newSession.date} (${conflict.timeSlot}) por "${conflict.title}".` });
    }
    await db.collection('sessions').insertOne(newSession);
    
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
    const updateData = req.body;
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
      const enrolled = await db.collection('sessions').findOne({ id, studentIds: req.user.id }, { projection: { _id: 1 } });
      if (!enrolled) return res.status(403).json({ error: 'Solo puedes evaluar sesiones en las que estás inscrito.' });
      await db.collection('sessions').updateOne({ id }, { $set: { [ownRatingKey]: { ...updateData[ownRatingKey], studentId: req.user.id, studentName: req.user.name } } });
      const updated = await db.collection('sessions').findOne({ id });
      emitEvent('sessions:changed', { action: 'update', sessionId: id, session: updated });
      return res.json({ success: true });
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

// La asistencia solo se puede registrar el mismo día de la clase (hora de Chile; el servidor corre en UTC)
const hasAttendanceOpened = (session) => {
  if (!session?.date) return false;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return session.date === today;
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

    if (!hasAttendanceOpened(session)) {
      return res.status(400).json({ error: 'La asistencia solo se puede registrar el día de la clase.' });
    }

    // Las sesiones personalizadas (1 a 1) solo admiten al estudiante para quien fueron creadas
    // (o a cualquiera si se crearon sin estudiante y aún nadie las tomó)
    const accessError = await checkPersonalizedAccess(db, session, studentId);
    if (accessError) return res.status(403).json({ error: accessError });

    const wasAlreadyPresent = session.attendance?.[studentId] === 'presente';
    const isEnrolled = (session.studentIds || []).includes(studentId);

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

