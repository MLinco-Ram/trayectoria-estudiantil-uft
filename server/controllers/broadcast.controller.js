import crypto from 'crypto';
import { formatMinimalEmail } from '../services/email.service.js';
import { enqueueEmails, processEmailQueue, queueStats } from '../services/emailQueue.service.js';
import { audit } from '../services/audit.service.js';

export const broadcastMessage = async (req, res) => {
  const { 
    docenteName, 
    scope, // 'all_community' | 'all_students' | 'all_tutors' | 'specific_session' | 'specific_tutor_par' | 'specific_tutor_de_tutores' | 'specific_student'
    sessionId,
    userId,
    subject, 
    message,
    priority // 'normal' | 'alta' | 'urgente'
  } = req.body;
  const db = req.db;
  // El emisor es quien tiene la sesión iniciada; el nombre enviado por el cliente es solo respaldo
  const senderName = req.user?.name || docenteName || 'Coordinación Docente UFT';

  try {
    if (!subject || !subject.trim() || !message || !message.trim()) {
      return res.status(400).json({ error: "El asunto y el mensaje son obligatorios." });
    }

    const users = await db.collection('users').find({}).toArray();
    let targetUsers = [];
    let contextTitle = '';

    if (scope === 'specific_session') {
      if (!sessionId) {
        return res.status(400).json({ error: "Debe seleccionar una tutoría o sesión específica." });
      }
      const session = await db.collection('sessions').findOne({ id: sessionId });
      if (!session) {
        return res.status(404).json({ error: "La tutoría seleccionada no fue encontrada." });
      }
      contextTitle = `Tutoría: "${session.title}" (${session.date} - ${session.timeSlot})`;

      const studentIds = session.studentIds || [];
      const tutorId = session.tutorId;

      targetUsers = users.filter(u => 
        (studentIds.includes(u.id) || (tutorId && u.id === tutorId)) && u.email
      );

      if (targetUsers.length === 0) {
        return res.status(400).json({ 
          error: "No se encontraron alumnos ni tutores con correo registrado en esta tutoría." 
        });
      }
    } else if (scope === 'specific_tutor_par' || scope === 'specific_tutor_de_tutores' || scope === 'specific_student') {
      // Un destinatario puntual, independiente de las tutorías en que participe
      if (!userId) {
        return res.status(400).json({ error: "Debe seleccionar el destinatario del comunicado." });
      }
      const target = users.find(u => u.id === userId);
      const roles = target ? [target.role, ...(Array.isArray(target.roles) ? target.roles : [])] : [];
      const tutorTypes = target ? [target.tutorType, ...(Array.isArray(target.tutorTypes) ? target.tutorTypes : [])] : [];
      // Un tutor sin subroles declarados se considera tutor par
      const isTutorPar = tutorTypes.includes('tutor_par') || tutorTypes.every(t => !t);
      const matchesScope = scope === 'specific_student'
        ? roles.includes('alumno')
        : scope === 'specific_tutor_par'
          ? roles.includes('tutor') && isTutorPar
          : roles.includes('tutor') && tutorTypes.includes('tutor_de_tutores');
      if (!target || !matchesScope) {
        return res.status(404).json({ error: "El destinatario seleccionado no fue encontrado." });
      }
      if (!target.email) {
        return res.status(400).json({ error: `${target.name} no tiene correo registrado.` });
      }
      contextTitle = scope === 'specific_student'
        ? 'Comunicado personal para estudiante'
        : scope === 'specific_tutor_par' ? 'Comunicado para Tutor Par' : 'Comunicado para Tutor de Tutores';
      // El enlace del correo apunta al portal que corresponde al destinatario elegido
      targetUsers = [{ ...target, role: scope === 'specific_student' ? 'alumno' : 'tutor' }];
    } else if (scope === 'all_students') {
      contextTitle = 'Comunidad de Estudiantes UFT';
      targetUsers = users.filter(u => u.role === 'alumno' && u.email);
    } else if (scope === 'all_tutors') {
      contextTitle = 'Equipo de Tutores Par UFT';
      targetUsers = users.filter(u => u.role === 'tutor' && u.email);
    } else {
      contextTitle = 'Comunidad de Tutorías y Acompañamiento UFT';
      targetUsers = users.filter(u => (u.role === 'alumno' || u.role === 'tutor') && u.email);
    }

    if (targetUsers.length === 0) {
      return res.status(400).json({ error: "No se encontraron destinatarios con correos válidos para este criterio." });
    }

    const priorityBadge = priority === 'urgente'
      ? '<span style="background-color: #ef4444; color: #ffffff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">Aviso Urgente</span>'
      : priority === 'alta'
      ? '<span style="background-color: #f59e0b; color: #ffffff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">Prioridad Alta</span>'
      : '<span style="background-color: #3b82f6; color: #ffffff; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">Comunicado</span>';

    const baseUrl = process.env.APP_URL || 'https://trayectoria-estudiantil-uft.vercel.app';
    // Los correos se encolan y se envían por lotes (ver emailQueue.service.js); lo que no alcance a salir en esta
    // petición lo termina el cron diario. Cada uno lleva su propio saludo y enlace.
    const emailSubject = `[UFT] Nuevo comunicado de ${senderName}`;
    const summaryText = `${senderName} publicó un nuevo comunicado en tu portal de Trayectoria Estudiantil UFT (${contextTitle}). Para leer el contenido completo e informarte de las novedades, ingresa directamente a la plataforma.`;
    await enqueueEmails(db, targetUsers.map(dest => {
      const actionUrl = `${baseUrl}/${dest.role === 'tutor' ? 'tutor' : dest.role === 'alumno' ? 'alumno' : 'docente'}`;
      return {
        to: dest.email,
        toName: dest.name,
        subject: emailSubject,
        text: `Estimado/a ${dest.name},\n\n${summaryText}\n\nIngresa directamente a la plataforma: ${actionUrl}`,
        html: formatMinimalEmail({ toName: dest.name, subject: emailSubject, summary: summaryText, actionUrl, actionText: 'Ingresar a la Plataforma' }),
      };
    }));
    await processEmailQueue(db, { maxMs: 7000 });
    const { pending } = await queueStats(db);
    const sentCount = targetUsers.length;

    const nowIso = new Date().toISOString();
    const notifDocs = targetUsers.map(u => ({
      id: `notif_broadcast_${crypto.randomUUID()}`,
      toEmail: u.email,
      toName: u.name,
      subject: `[UFT] ${subject.trim()}`,
      message: message.trim(),
      timestamp: nowIso,
      read: false,
      priority: priority || 'normal',
      fromName: senderName,
      // Los tutores deben confirmar una vez que recibieron el comunicado; el aviso de confirmación vuelve a quien lo envió
      ...(u.role === 'tutor' && req.user?.email ? { requiresConfirmation: true, fromEmail: req.user.email } : {})
    }));

    if (notifDocs.length > 0) {
      await db.collection('notifications').insertMany(notifDocs);
    }

    await db.collection('broadcast_history').insertOne({
      docenteName: senderName,
      scope,
      sessionId: sessionId || null,
      contextTitle,
      subject: subject.trim(),
      message: message.trim(),
      priority: priority || 'normal',
      recipientsCount: sentCount,
      recipientEmails: targetUsers.map(u => u.email),
      createdAt: new Date()
    });

    await audit(req, 'broadcast.sent', { scope, sessionId: sessionId || null }, { recipients: sentCount });
    res.json({
      success: true,
      sentCount,
      recipients: targetUsers.map(u => ({ name: u.name, role: u.role })),
      queued: pending,
      message: pending > 0
        ? `Aviso registrado para ${sentCount} destinatario(s) (${contextTitle}). Quedan ${pending} correo(s) en cola que se enviarán automáticamente.`
        : `¡Aviso enviado exitosamente a ${sentCount} destinatario(s) (${contextTitle})!`
    });
  } catch (err) {
    console.error("[Broadcast-Error]:", err);
    res.status(500).json({ error: "Error al emitir el comunicado" });
  }
};
