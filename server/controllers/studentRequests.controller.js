import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';

export const getStudentRequests = async (req, res) => {
  const db = req.db;
  try {
    const requests = await db.collection('student_requests').find({}).toArray();
    res.json(requests);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const createStudentRequest = async (req, res) => {
  const db = req.db;
  try {
    const request = req.body;
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
