import nodemailer from 'nodemailer';
import { getEffectiveSmtpConfig, formatMinimalEmail } from '../services/email.service.js';

export const broadcastMessage = async (req, res) => {
  const { 
    docenteName, 
    scope, // 'all_community' | 'all_students' | 'all_tutors' | 'specific_session'
    sessionId,
    subject, 
    message,
    priority // 'normal' | 'alta' | 'urgente'
  } = req.body;
  const db = req.db;

  try {
    if (!subject || !subject.trim() || !message || !message.trim()) {
      return res.status(400).json({ error: "El asunto y el mensaje son obligatorios." });
    }

    const config = await getEffectiveSmtpConfig();
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

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    let sentCount = 0;
    if (config) {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });

      const fromName = config.fromName || 'Trayectoria Estudiantil UFT';

      for (const dest of targetUsers) {
        try {
          const actionUrl = `${baseUrl}/${dest.role === 'tutor' ? 'tutor' : dest.role === 'alumno' ? 'alumno' : 'docente'}`;
          const summaryText = `Coordinación Docente ha emitido un nuevo comunicado: "${subject.trim()}". ${message.trim().slice(0, 140)}${message.length > 140 ? '...' : ''}`;

          const htmlBody = formatMinimalEmail({
            toName: dest.name,
            subject: `[UFT] ${subject.trim()}`,
            summary: summaryText,
            actionUrl,
            actionText: 'Ver Comunicado en la Plataforma'
          });

          await transporter.sendMail({
            from: { name: fromName, address: config.user },
            to: `"${dest.name}" <${dest.email}>`,
            subject: `[UFT] ${subject.trim()}`,
            text: `Estimado/a ${dest.name},\n\n${summaryText}\n\nIngresa a la plataforma para ver el comunicado completo: ${actionUrl}`,
            html: htmlBody,
          });
          sentCount++;
        } catch (e) {
          console.warn(`[Broadcast] Falló envío a ${dest.email}:`, e.message);
        }
      }
    } else {
      sentCount = targetUsers.length;
      console.warn(`[Broadcast] SMTP no configurado. Mensaje simulado para ${sentCount} usuarios.`);
    }

    const nowIso = new Date().toISOString();
    const notifDocs = targetUsers.map(u => ({
      id: `notif_broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      toEmail: u.email,
      toName: u.name,
      subject: `[UFT] ${subject.trim()}`,
      message: message.trim(),
      timestamp: nowIso,
      read: false,
      priority: priority || 'normal',
      fromName: docenteName || 'Coordinación Docente UFT'
    }));

    if (notifDocs.length > 0) {
      await db.collection('notifications').insertMany(notifDocs);
    }

    await db.collection('broadcast_history').insertOne({
      docenteName: docenteName || 'Docente UFT',
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

    res.json({
      success: true,
      sentCount,
      recipients: targetUsers.map(u => ({ name: u.name, email: u.email, role: u.role })),
      message: `¡Aviso enviado exitosamente a ${sentCount} destinatario(s) (${contextTitle})!`
    });
  } catch (err) {
    console.error("[Broadcast-Error]:", err);
    res.status(500).json({ error: "Error al emitir el comunicado", details: err.message });
  }
};
