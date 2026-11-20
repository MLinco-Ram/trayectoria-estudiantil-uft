import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';
import { isStaff } from '../middlewares/auth.js';
import crypto from 'crypto';
import { pickFields, str, strArray } from '../utils/validate.js';
import { audit } from '../services/audit.service.js';
import { encryptField, decryptField } from '../services/crypto.service.js';

export const getStudentRequests = async (req, res) => {
  const db = req.db;
  try {
    // Un alumno solo ve sus propias solicitudes
    const requests = await db.collection('student_requests').find(isStaff(req) ? {} : { studentId: req.user.id }).toArray();
    // El motivo puede incluir datos de salud o situación personal: se guarda cifrado
    res.json(requests.map(r => ({ ...r, message: decryptField(r.message) })));
  } catch (err) {
    sendServerError(res, err);
  }
};

const REQUEST_FIELDS = {
  studentCareer: v => str(v, 200),
  program: v => str(v, 60),
  message: v => str(v, 2000),
  preferredTime: v => str(v, 500),
  conflictSessionId: v => str(v, 100),
  conflictSessionLabel: v => str(v, 300),
};

// Solo se guardan los campos esperados (M-04); el alumno, el id y el estado los fija el servidor
export const createStudentRequest = async (req, res) => {
  const db = req.db;
  try {
    const picked = pickFields(req.body, REQUEST_FIELDS);
    if (picked.error) return res.status(400).json({ error: picked.error });
    const request = {
      ...picked.value,
      id: `req_${crypto.randomUUID()}`,
      studentId: req.user.id,
      studentName: req.user.name,
      status: 'pendiente',
      createdAt: new Date().toISOString(),
    };
    // Coordinación puede crearla a nombre de un alumno
    if (isStaff(req) && typeof req.body?.studentId === 'string') {
      request.studentId = req.body.studentId.slice(0, 100);
      request.studentName = str(req.body.studentName, 200) || request.studentName;
    }
    await db.collection('student_requests').insertOne({ ...request, message: request.message ? encryptField(request.message) : request.message });

    // Notificar en tiempo real (al docente y al alumno)
    emitEvent('student_requests:changed', { action: 'create', request });

    res.status(201).json(request);
  } catch (err) {
    sendServerError(res, err);
  }
};

// Solo coordinación resuelve solicitudes, y solo cambia estado y sesión asignada (nunca crea con upsert)
export const updateStudentRequest = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const picked = pickFields(req.body, {
      status: v => (['pendiente', 'resuelto'].includes(v) ? v : undefined),
      assignedSessionId: v => str(v, 100),
      resolvedAt: v => str(v, 40),
    });
    if (picked.error) return res.status(400).json({ error: picked.error });
    if (Object.keys(picked.value).length === 0) return res.status(400).json({ error: 'No hay datos para actualizar.' });
    const result = await db.collection('student_requests').updateOne({ id }, { $set: picked.value });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
    await audit(req, 'student_request.update', { requestId: id });

    emitEvent('student_requests:changed', { action: 'update', requestId: id });

    res.json({ success: true, updated: picked.value });
  } catch (err) {
    sendServerError(res, err);
  }
};
