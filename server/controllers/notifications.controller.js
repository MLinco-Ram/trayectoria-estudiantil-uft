import { emitEvent } from '../services/socket.service.js';

export const getNotifications = async (req, res) => {
  const { email } = req.query;
  const db = req.db;
  try {
    const query = {};
    if (email) {
      query.toEmail = { $regex: new RegExp(`^${email.toString().trim()}$`, 'i') };
    }
    const notifs = await db.collection('notifications').find(query).sort({ timestamp: -1 }).toArray();
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createNotification = async (req, res) => {
  const db = req.db;
  try {
    const newNotif = {
      id: req.body.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      toEmail: req.body.toEmail,
      toName: req.body.toName || '',
      subject: req.body.subject || 'Aviso UFT',
      message: req.body.message || '',
      timestamp: req.body.timestamp || new Date().toISOString(),
      read: req.body.read || false,
      priority: req.body.priority || 'normal',
      fromName: req.body.fromName || 'Trayectoria UFT'
    };

    await db.collection('notifications').insertOne(newNotif);
    
    // Notificar en tiempo real al destinatario o global
    emitEvent('notifications:changed', { action: 'create', notification: newNotif });

    res.status(201).json(newNotif);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const markAsRead = async (req, res) => {
  const { id } = req.params;
  const db = req.db;
  try {
    await db.collection('notifications').updateOne(
      { id },
      { $set: { read: true } }
    );
    
    emitEvent('notifications:changed', { action: 'mark_read', id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const markAllAsRead = async (req, res) => {
  const { email } = req.body;
  const db = req.db;
  try {
    const query = {};
    if (email) {
      query.toEmail = { $regex: new RegExp(`^${email.trim()}$`, 'i') };
    }
    await db.collection('notifications').updateMany(
      query,
      { $set: { read: true } }
    );
    
    emitEvent('notifications:changed', { action: 'mark_all_read', email });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
