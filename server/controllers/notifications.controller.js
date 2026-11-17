import { emitEvent } from '../services/socket.service.js';
import { sendServerError } from '../utils/errors.js';
import { isStaff, canSendTo } from '../middlewares/auth.js';

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const emailQuery = (email) => ({ $regex: new RegExp(`^${escapeRegex(String(email).trim())}$`, 'i') });
// Quien no es coordinación solo ve y marca sus propias notificaciones, sin importar el correo que pida
const ownEmailOr = (req, email) => (isStaff(req) ? email : req.user?.email);

export const getNotifications = async (req, res) => {
  const email = ownEmailOr(req, req.query.email);
  const db = req.db;
  try {
    const query = {};
    if (email) query.toEmail = emailQuery(email);
    else if (!isStaff(req)) return res.json([]);
    const notifs = await db.collection('notifications').find(query).sort({ timestamp: -1 }).toArray();
    res.json(notifs);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const createNotification = async (req, res) => {
  const db = req.db;
  try {
    if (!(await canSendTo(req, req.body.toEmail))) {
      return res.status(403).json({ error: 'No puedes enviar notificaciones a ese destinatario.' });
    }
    const newNotif = {
      id: req.body.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      toEmail: req.body.toEmail,
      toName: req.body.toName || '',
      subject: req.body.subject || 'Aviso UFT',
      message: req.body.message || '',
      timestamp: req.body.timestamp || new Date().toISOString(),
      read: req.body.read || false,
      priority: req.body.priority || 'normal',
      fromName: isStaff(req) ? (req.body.fromName || 'Trayectoria UFT') : 'Trayectoria UFT'
    };

    await db.collection('notifications').insertOne(newNotif);
    
    // Notificar en tiempo real al destinatario o global
    emitEvent('notifications:changed', { action: 'create', notification: newNotif });

    res.status(201).json(newNotif);
  } catch (err) {
    sendServerError(res, err);
  }
};

export const markAsRead = async (req, res) => {
  const { id } = req.params;
  const db = req.db;
  try {
    await db.collection('notifications').updateOne(
      isStaff(req) ? { id } : { id, toEmail: emailQuery(req.user.email) },
      { $set: { read: true } }
    );
    
    emitEvent('notifications:changed', { action: 'mark_read', id });

    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
};

export const markAllAsRead = async (req, res) => {
  const email = ownEmailOr(req, req.body.email);
  const db = req.db;
  try {
    const query = {};
    if (email) query.toEmail = emailQuery(email);
    else if (!isStaff(req)) return res.json({ success: true });
    await db.collection('notifications').updateMany(
      query,
      { $set: { read: true } }
    );
    
    emitEvent('notifications:changed', { action: 'mark_all_read', email });

    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
};

// El destinatario confirma una sola vez que recibió un comunicado que lo pide. Al confirmar, quien lo envió recibe un aviso.
export const confirmNotification = async (req, res) => {
  const { id } = req.params;
  const db = req.db;
  try {
    const own = { id, toEmail: emailQuery(req.user.email), requiresConfirmation: true };
    const confirmedAt = new Date().toISOString();
    // El filtro sin confirmedAt hace que solo una solicitud pueda confirmar (doble clic o dos pestañas)
    const result = await db.collection('notifications').updateOne(
      { ...own, confirmedAt: { $exists: false } },
      { $set: { confirmedAt, read: true } }
    );
    const notif = await db.collection('notifications').findOne(own);
    if (!notif) return res.status(404).json({ error: 'Este mensaje no requiere confirmación.' });
    if (result.matchedCount === 0) {
      return res.json({ success: true, alreadyConfirmed: true, confirmedAt: notif.confirmedAt });
    }

    emitEvent('notifications:changed', { action: 'confirm', id, notification: notif });

    if (notif.fromEmail) {
      const when = new Date(confirmedAt).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const ack = {
        id: `notif_confirm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        toEmail: notif.fromEmail,
        toName: notif.fromName || '',
        subject: `✓ Confirmación de recepción: ${notif.subject}`,
        message: `${req.user.name || notif.toName || notif.toEmail} confirmó la recepción del comunicado "${notif.subject}" el ${when.replace(/\.$/, "")}.`,
        timestamp: confirmedAt,
        read: false,
        priority: 'normal',
        fromName: 'Trayectoria UFT'
      };
      await db.collection('notifications').insertOne(ack);
      emitEvent('notifications:changed', { action: 'create', notification: ack });
    }

    res.json({ success: true, confirmedAt });
  } catch (err) {
    sendServerError(res, err);
  }
};
