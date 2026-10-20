import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';

// Código de sala: texto libre corto (ej: B405, Trayectorias, B-101) y una descripción opcional
export const ROOM_CODE_MAX = 30;
export const ROOM_DESCRIPTION_MAX = 120;
export const normalizeRoomCode = (code) => String(code || '').trim().replace(/\s+/g, ' ');
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getRooms = async (req, res) => {
  try {
    const rooms = await req.db.collection('rooms').find({}).sort({ code: 1 }).toArray();
    res.json(rooms);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const createRoom = async (req, res) => {
  try {
    const code = normalizeRoomCode(req.body?.code);
    const description = String(req.body?.description || '').trim().slice(0, ROOM_DESCRIPTION_MAX);
    if (!code || code.length > ROOM_CODE_MAX) {
      return res.status(400).json({ error: `El código de sala es obligatorio (máximo ${ROOM_CODE_MAX} caracteres).` });
    }
    // Sin distinguir mayúsculas: "b405" y "B405" son la misma sala
    const existing = await req.db.collection('rooms').findOne({ code: { $regex: `^${escapeRegex(code)}$`, $options: 'i' } });
    if (existing) {
      return res.status(409).json({ error: `La sala ${code} ya está registrada.` });
    }
    const room = { id: `room_${Date.now()}`, code, ...(description ? { description } : {}), createdAt: new Date().toISOString() };
    await req.db.collection('rooms').insertOne(room);
    emitEvent('rooms:changed', { action: 'create', room });
    res.status(201).json(room);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const room = await req.db.collection('rooms').findOne({ id: req.params.id });
    if (!room) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    const inUse = await req.db.collection('sessions').countDocuments({ location: room.code, isCompleted: { $ne: true } });
    if (inUse > 0) {
      return res.status(409).json({ error: `La sala ${room.code} tiene ${inUse} sesión(es) activa(s); no se puede eliminar.` });
    }
    const result = await req.db.collection('rooms').deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }
    emitEvent('rooms:changed', { action: 'delete', roomId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
};
