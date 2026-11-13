import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';
import { isStaff } from '../middlewares/auth.js';

export const getStudentRequests = async (req, res) => {
  const db = req.db;
  try {
    // Un alumno solo ve sus propias solicitudes
    const requests = await db.collection('student_requests').find(isStaff(req) ? {} : { studentId: req.user.id }).toArray();
    res.json(requests);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const createStudentRequest = async (req, res) => {
  const db = req.db;
  try {
    const request = req.body;
    delete request._id;
    if (!isStaff(req)) {
      // La solicitud siempre queda a nombre de quien la envía y pendiente
      request.studentId = req.user.id;
      request.studentName = req.user.name;
      request.status = 'pendiente';
    }
    await db.collection('student_requests').insertOne(request);
    
    // Notificar en tiempo real (al docente y al alumno)
    emitEvent('student_requests:changed', { action: 'create', request });

    res.status(201).json(request);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const updateStudentRequest = async (req, res) => {
  const db = req.db;
  try {
    const { id } = req.params;
    const updateData = req.body;
    delete updateData._id;
    await db.collection('student_requests').updateOne(
      { id }, 
      { $set: updateData }, 
      { upsert: true }
    );
    
    // Notificar en tiempo real
    emitEvent('student_requests:changed', { action: 'update', requestId: id, updateData });

    res.json({ success: true, updated: updateData });
  } catch (err) {
    sendServerError(res, err);
  }
};
