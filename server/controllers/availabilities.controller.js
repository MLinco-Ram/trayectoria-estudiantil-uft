import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';
import { isTutorOrStaff, isStaff } from '../middlewares/auth.js';

export const getAvailabilities = async (req, res) => {
  const db = req.db;
  try {
    // Los tutores ven todas (para sugerir reemplazos); un alumno solo la suya
    const data = await db.collection('availabilities').find(isTutorOrStaff(req) ? {} : { userId: req.user.id }).toArray();
    res.json(data);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const saveAvailability = async (req, res) => {
  const db = req.db;
  try {
    const availability = req.body;
    delete availability._id;
    // Solo coordinación puede guardar el horario de otra persona
    if (!isStaff(req)) availability.userId = req.user.id;
    await db.collection('availabilities').updateOne(
      { userId: availability.userId },
      { $set: availability },
      { upsert: true }
    );

    emitEvent('availabilities:changed', { action: 'save', availability });

    res.json({ success: true, availability });
  } catch (err) {
    sendServerError(res, err);
  }
};
