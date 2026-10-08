import { emitEvent } from '../services/socket.service.js';

export const getReports = async (req, res) => {
  const db = req.db;
  try {
    const reports = await db.collection('reports').find({}).toArray();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
};
