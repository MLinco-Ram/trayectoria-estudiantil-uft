import { emitEvent } from '../services/socket.service.js';

export const getAvailabilities = async (req, res) => {
  const db = req.db;
  try {
    const data = await db.collection('availabilities').find({}).toArray();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const saveAvailability = async (req, res) => {
  const db = req.db;
  try {
    const availability = req.body;
    delete availability._id;
    await db.collection('availabilities').updateOne(
      { userId: availability.userId },
      { $set: availability },
      { upsert: true }
    );

    emitEvent('availabilities:changed', { action: 'save', availability });

    res.json({ success: true, availability });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
