import crypto from 'crypto';
import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';
import { isTutorOrStaff, isStaff } from '../middlewares/auth.js';
import { encryptField, decryptField } from '../services/crypto.service.js';

export const getReports = async (req, res) => {
  const db = req.db;
  try {
    // Las alertas son de tutores y coordinación; un alumno no las necesita
    if (!isTutorOrStaff(req)) return res.json([]);
    // Un tutor ve solo sus propios reportes (pueden contener datos de salud); coordinación ve todos.
    // La descripción se guarda cifrada.
    const reports = await db.collection('reports').find(isStaff(req) ? {} : { tutorId: req.user.id }).toArray();
    res.json(reports.map(r => ({ ...r, description: decryptField(r.description), ...(r.resolutionNote ? { resolutionNote: decryptField(r.resolutionNote) } : {}) })));
  } catch (err) {
    sendServerError(res, err);
  }
};

const REQUEST_TYPES = ['reasignar_horario', 'reasignar_tutor', 'otro'];
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Solo se guardan los campos esperados; el autor y el estado los fija el servidor (no el cliente)
export const createReport = async (req, res) => {
  const db = req.db;
  try {
    const body = req.body || {};
    const description = str(body.description, 2000);
    const sessionId = str(body.sessionId, 100);
    if (!description || !sessionId) {
      return res.status(400).json({ error: 'Indica la tutoría y describe el inconveniente.' });
    }
    const report = {
      id: str(body.id, 100) || `report_${crypto.randomUUID()}`,
      sessionId,
      tutorId: req.user.id,
      description,
      requestType: REQUEST_TYPES.includes(body.requestType) ? body.requestType : 'otro',
      status: 'pendiente',
      createdAt: new Date().toISOString(),
    };
    const proposedTime = str(body.proposedTime, 30);
    if (proposedTime) report.proposedTime = proposedTime;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str(body.proposedDate, 10))) report.proposedDate = body.proposedDate;
    const suggestedTutorId = str(body.suggestedTutorId, 100);
    if (suggestedTutorId) {
      report.suggestedTutorId = suggestedTutorId;
      report.suggestedTutorName = str(body.suggestedTutorName, 200);
    }

    await db.collection('reports').insertOne({ ...report, description: encryptField(report.description) });
    emitEvent('reports:changed', { action: 'create', reportId: report.id });
    res.status(201).json(report);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const updateReport = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    // Coordinación solo puede registrar la resolución del caso
    const body = req.body || {};
    const updateData = {};
    if (body.status === 'resuelto' || body.status === 'pendiente') updateData.status = body.status;
    if (typeof body.resolvedAt === 'string') updateData.resolvedAt = body.resolvedAt.slice(0, 40);
    if (typeof body.resolutionNote === 'string') updateData.resolutionNote = encryptField(body.resolutionNote.slice(0, 2000));
    if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'No hay datos para actualizar.' });
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
