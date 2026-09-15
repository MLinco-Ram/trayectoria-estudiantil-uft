import { emitEvent } from '../services/socket.service.js';

export const getSessions = async (req, res) => {
  const db = req.db;
  try {
    const sessions = await db.collection('sessions').find({}).toArray();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createSession = async (req, res) => {
  const db = req.db;
  try {
    const newSession = req.body;
    await db.collection('sessions').insertOne(newSession);
    
    // Notificar en tiempo real a todos los clientes
    emitEvent('sessions:changed', { action: 'create', session: newSession });
    
    res.status(201).json(newSession);
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    // Notificar en tiempo real a todos los clientes
    emitEvent('sessions:changed', { action: 'update', sessionId: id, session: updatedFullSession || updateData });
    
    res.json({ success: true, updated: updateData });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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

    const attendance = session.attendance || {};
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
    emitEvent('sessions:changed', { action: 'update', sessionId: id, session: updatedSession });

    res.json({ success: true, session: updatedSession, message: 'Asistencia registrada con éxito' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

