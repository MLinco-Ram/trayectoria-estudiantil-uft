import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';
import { normalizeRoomCode } from './rooms.controller.js';

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
    res.json(sessions);
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

export const registerQRAttendance = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId es requerido' });
    }

    const session = await db.collection('sessions').findOne({ id });
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    // Las sesiones personalizadas (1 a 1) solo admiten al estudiante para quien fueron creadas
    // (o a cualquiera si se crearon sin estudiante y aún nadie las tomó)
    const isPersonalized = session.type === 'tutoria_personalizada' || session.type === 'psico_asesoria_individual' || session.maxSpots === 1;
    const isAssigned = (session.studentIds || []).includes(studentId) || session.reservedForStudentId === studentId;
    const isOpenSlot = !session.reservedForStudentId && (session.studentIds || []).length === 0;
    if (isPersonalized && !isAssigned && !isOpenSlot) {
      return res.status(403).json({ error: 'Esta tutoría es personalizada y está asignada exclusivamente a otro estudiante.' });
    }
    // De un grupo de horarios ofrecidos el estudiante toma uno solo
    if (isPersonalized && !isAssigned && session.offerGroupId) {
      const sibling = await db.collection('sessions').findOne({ offerGroupId: session.offerGroupId, id: { $ne: id }, studentIds: studentId });
      if (sibling) {
        return res.status(403).json({ error: 'Ya tomaste otro de los horarios ofrecidos para esta sesión.' });
      }
    }

    const attendance = session.attendance || {};
    const wasAlreadyPresent = attendance[studentId] === 'presente';

    attendance[studentId] = 'presente';

    const studentIds = Array.isArray(session.studentIds) ? [...session.studentIds] : [];
    if (!studentIds.includes(studentId)) {
      studentIds.push(studentId);
    }

    await db.collection('sessions').updateOne(
      { id },
      { $set: { attendance, studentIds } }
    );

    const updatedSession = await db.collection('sessions').findOne({ id });
    await releaseOfferGroup(db, updatedSession);
    emitEvent('sessions:changed', { action: 'update', sessionId: id, session: updatedSession });

    res.json({ 
      success: true, 
      alreadyPresent: wasAlreadyPresent,
      session: updatedSession, 
      message: wasAlreadyPresent 
        ? '¡Ya te encontrabas registrado como presente en esta tutoría!' 
        : '¡Asistencia registrada con éxito!' 
    });
  } catch (err) {
    sendServerError(res, err);
  }
};

