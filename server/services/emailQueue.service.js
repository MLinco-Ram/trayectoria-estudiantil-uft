import { createTransporter, formatMinimalEmail } from './email.service.js';

// Cola de correos (colección email_queue): un comunicado a 1.000 alumnos ya no envía 1.000 correos seguidos
// dentro de una sola petición (Vercel la cortaba por tiempo límite). Se encola, se envía por lotes dentro de un
// presupuesto de tiempo y lo que sobra lo termina el cron diario (/api/cron/daily). Cada correo se marca
// como enviado, así un reintento nunca duplica envíos.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const STUCK_AFTER_MS = 5 * 60 * 1000;

export async function enqueueEmails(db, items) {
  if (!items.length) return 0;
  const now = new Date();
  await db.collection('email_queue').insertMany(items.map(i => ({
    to: i.to, toName: i.toName || '', subject: i.subject, text: i.text, html: i.html || null,
    status: 'pending', attempts: 0, runAfter: now, createdAt: now,
  })));
  return items.length;
}

export const queueStats = async (db) => ({
  pending: await db.collection('email_queue').countDocuments({ status: { $in: ['pending', 'sending'] } }),
  failed: await db.collection('email_queue').countDocuments({ status: 'failed' }),
});

// Envía correos pendientes hasta agotar el tiempo (maxMs). Devuelve cuántos salieron.
export async function processEmailQueue(db, { maxMs = 8000 } = {}) {
  const col = db.collection('email_queue');
  const started = Date.now();
  // Un envío que quedó "sending" (la función se cortó) vuelve a la cola
  await col.updateMany({ status: 'sending', lockedAt: { $lt: new Date(Date.now() - STUCK_AFTER_MS) } }, { $set: { status: 'pending' } });

  const client = await createTransporter();
  let sent = 0;
  while (Date.now() - started < maxMs) {
    const claimed = await col.findOneAndUpdate(
      { status: 'pending', runAfter: { $lte: new Date() } },
      { $set: { status: 'sending', lockedAt: new Date() }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, returnDocument: 'after' }
    );
    const job = claimed?.value !== undefined ? claimed.value : claimed;
    if (!job) break;

    if (!client) {
      console.warn(`[Queue] SMTP no configurado. Correo simulado para ${job.to}.`);
      await col.updateOne({ _id: job._id }, { $set: { status: 'sent', sentAt: new Date(), simulated: true }, $unset: { text: '', html: '' } });
      sent++;
      continue;
    }
    try {
      const { transporter, config } = client;
      await transporter.sendMail({
        from: { name: config.fromName || 'Trayectoria Estudiantil UFT', address: config.user },
        to: job.toName ? `"${job.toName}" <${job.to}>` : job.to,
        subject: job.subject,
        text: job.text,
        html: job.html || formatMinimalEmail({ toName: job.toName, subject: job.subject, summary: job.text }),
      });
      await col.updateOne({ _id: job._id }, { $set: { status: 'sent', sentAt: new Date() }, $unset: { text: '', html: '' } });
      sent++;
    } catch (err) {
      console.warn(`[Queue] Falló el envío a ${job.to} (intento ${job.attempts}):`, err.message);
      await col.updateOne({ _id: job._id }, job.attempts >= MAX_ATTEMPTS
        ? { $set: { status: 'failed', lastError: String(err.message).slice(0, 200) }, $unset: { text: '', html: '' } }
        : { $set: { status: 'pending', runAfter: new Date(Date.now() + RETRY_DELAY_MS), lastError: String(err.message).slice(0, 200) } });
    }
  }
  return sent;
}
