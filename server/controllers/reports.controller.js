import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';

export const getReports = async (req, res) => {
  const db = req.db;
  try {
    const reports = await db.collection('reports').find({}).toArray();
    res.json(reports);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const createReport = async (req, res) => {
  const db = req.db;
  try {
    const report = req.body;
    await db.collection('reports').insertOne(report);
    
    emitEvent('reports:changed', { action: 'create', report });

    res.status(201).json(report);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const updateReport = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const updateData = req.body;
    delete updateData._id;
    const result = await db.collection('reports').updateOne({ id }, { $set: updateData });
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    emitEvent('reports:changed', { action: 'update', reportId: id, updateData });

    res.json({ success: true, updated: updateData });
  } catch (err) {
    sendServerError(res, err);
  }
};
