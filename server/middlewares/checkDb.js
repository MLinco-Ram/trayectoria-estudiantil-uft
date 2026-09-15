import { getDb, connectDB } from '../db.js';

export const checkDb = async (req, res, next) => {
  let db = getDb();
  if (!db) {
    try {
      db = await connectDB();
    } catch (e) {
      return res.status(503).json({ error: "Base de datos conectando..." });
    }
  }
  req.db = db;
  next();
};
