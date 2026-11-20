import { getOrConnectDB } from '../db.js';
import { enqueueEmails, processEmailQueue } from './emailQueue.service.js';
import { formatMinimalEmail } from './email.service.js';

// "Mañana" en hora de Chile (el servidor corre en UTC: a las 21:00 de Chile ya es mañana en UTC)
export const tomorrowInSantiago = (now = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = fmt.format(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

// Recordatorio a cada tutor con tutorías mañana. Cada sesión se reclama de forma atómica con reminderSentAt:
// aunque el cron corra varias veces (o cada hora en un servidor propio) el aviso sale una sola vez.
export const checkAndSendTutorDailyReminders = async () => {
  const db = await getOrConnectDB();
  if (!db) return { sent: 0, message: 'No DB connection' };

  try {
    const tomorrowStr = tomorrowInSantiago();
    const sessions = await db.collection('sessions')
      .find({ date: tomorrowStr, tutorId: { $ne: null }, reminderSentAt: { $exists: false } }).toArray();
    if (sessions.length === 0) {
      return { sent: 0, message: `No hay tutorías pendientes de recordatorio para mañana (${tomorrowStr}).` };
    }

    const baseUrl = process.env.APP_URL || 'https://trayectoria-estudiantil-uft.vercel.app';
    const items = [];
    for (const sess of sessions) {
      const claim = await db.collection('sessions').updateOne(
        { id: sess.id, reminderSentAt: { $exists: false } },
        { $set: { reminderSentAt: new Date() } }
      );
      if (claim.modifiedCount === 0) continue; // otra ejecución ya la tomó

      const tutor = await db.collection('users').findOne({ id: sess.tutorId }, { projection: { name: 1, email: 1 } });
      if (!tutor?.email) continue;

      const count = (sess.studentIds || []).length;
      const subject = `Recordatorio: Tu tutoría de mañana "${sess.title}" (${count} alumno${count === 1 ? '' : 's'} inscrito${count === 1 ? '' : 's'})`;
      const summary = `Te recordamos que tienes una sesión de tutoría programada para mañana (${sess.date}). Ingresa a la plataforma para revisar los detalles completos, la nómina de estudiantes y pasar asistencia.`;
      const actionUrl = `${baseUrl}/tutor`;
      items.push({
        to: tutor.email,
        toName: tutor.name,
        subject,
        text: `Hola ${tutor.name},\n\n${summary}\n\nIngresa aquí: ${actionUrl}`,
        html: formatMinimalEmail({ toName: tutor.name, subject, summary, actionUrl, actionText: 'Ver Tutoría en la Plataforma' }),
      });
    }

    await enqueueEmails(db, items);
    const sent = await processEmailQueue(db, { maxMs: 8000 });
    return { sent, queued: items.length, message: `Se registraron ${items.length} recordatorios para las tutorías de mañana (${tomorrowStr}); ${sent} enviados ahora.` };
  } catch (err) {
    console.error('[Auto-Reminder] Error general:', err);
    return { error: 'Error al procesar los recordatorios.' };
  }
};

// Política de conservación (Ley 21.719): no se guardan datos personales más tiempo del necesario
export const runRetention = async () => {
  const db = await getOrConnectDB();
  const day = 24 * 60 * 60 * 1000;
  const iso = (days) => new Date(Date.now() - days * day).toISOString();
  const date = (days) => new Date(Date.now() - days * day);
  const result = {};
  // Listas de destinatarios de comunicados: 90 días (queda el asunto y la cantidad, no los correos)
  result.broadcastRecipients = (await db.collection('broadcast_history')
    .updateMany({ createdAt: { $lt: date(90) }, recipientEmails: { $exists: true } }, { $unset: { recipientEmails: '' } })).modifiedCount;
  // Notificaciones internas: 180 días
  result.notifications = (await db.collection('notifications').deleteMany({ timestamp: { $lt: iso(180) } })).deletedCount;
  // Cola de correos terminada: 30 días
  result.emailQueue = (await db.collection('email_queue').deleteMany({ status: { $in: ['sent', 'failed'] }, createdAt: { $lt: date(30) } })).deletedCount;
  // Bitácora de auditoría: 2 años
  result.auditLog = (await db.collection('audit_log').deleteMany({ at: { $lt: date(730) } })).deletedCount;
  return result;
};

export const startCronJobs = () => {
  // Servidor propio (no Vercel): cada hora. Es seguro repetirlo porque los recordatorios se marcan como enviados.
  if (process.env.VERCEL) return;
  setInterval(async () => {
    await checkAndSendTutorDailyReminders();
    const db = await getOrConnectDB();
    if (db) await processEmailQueue(db, { maxMs: 20000 });
  }, 1000 * 60 * 60);
};
