import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';
import { isTutorOrStaff, isStaff } from '../middlewares/auth.js';
import { pickFields, str, strArray, isPlainObject } from '../utils/validate.js';

export const getAvailabilities = async (req, res) => {
  const db = req.db;
  try {
    // Coordinación ve todas; un tutor ve las de tutores (para sugerir reemplazos) y la suya, no las de alumnos; un alumno solo la suya
    const filter = isStaff(req) ? {} : isTutorOrStaff(req) ? { $or: [{ role: 'tutor' }, { userId: req.user.id }] } : { userId: req.user.id };
    const data = await db.collection('availabilities').find(filter).toArray();
    res.json(data);
  } catch (err) {
    sendServerError(res, err);
  }
};

const validDays = (v) =>
  Array.isArray(v) && v.length <= 7 && v.every(d => isPlainObject(d) && typeof d.day === 'string' && d.day.length <= 20 && strArray(d.slots, { maxItems: 30, maxLen: 30 }) && d.slots.every(sl => /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(sl)))
    ? v.map(d => ({ day: d.day, slots: d.slots }))
    : undefined;

export const saveAvailability = async (req, res) => {
  const db = req.db;
  try {
    const picked = pickFields(req.body, {
      userId: v => str(v, 100),
      role: v => (['alumno', 'tutor'].includes(v) ? v : undefined),
      userName: v => str(v, 200),
      career: v => str(v, 200),
      days: validDays,
    });
    if (picked.error) return res.status(400).json({ error: picked.error });
    const availability = { ...picked.value, updatedAt: new Date().toISOString() };
    // Solo coordinación puede guardar el horario de otra persona
    if (!isStaff(req) || !availability.userId) availability.userId = req.user.id;
    await db.collection('availabilities').updateOne(
      { userId: availability.userId },
      { $set: availability },
      { upsert: true }
    );

    emitEvent('availabilities:changed', { action: 'save', userId: availability.userId });

    res.json({ success: true, availability });
  } catch (err) {
    sendServerError(res, err);
  }
};
