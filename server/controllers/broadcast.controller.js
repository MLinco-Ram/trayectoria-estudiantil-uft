import nodemailer from 'nodemailer';
import { getEffectiveSmtpConfig } from '../services/email.service.js';

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

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; margin: 0 auto;">
        <div style="background-color: #092c4c; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
          <h2 style="color: #ffffff; margin: 0; font-size: 18px; letter-spacing: 0.5px;">Universidad Finis Terrae</h2>
          <p style="color: #3a9ad9; margin: 4px 0 0; font-size: 12px; font-weight: bold; text-transform: uppercase;">
            Centro de Apoyo al Aprendizaje • Trayectoria UFT
          </p>
        </div>

        <div style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          ${priorityBadge}
          <span style="font-size: 12px; color: #64748b; font-weight: bold;">${new Date().toLocaleDateString('es-CL')}</span>
        </div>

        <h3 style="color: #092c4c; margin: 0 0 12px 0; font-size: 17px;">
          ${subject.trim()}
        </h3>

        <div style="background-color: #f8fafc; border-left: 4px solid #3a9ad9; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
          <p style="margin: 0 0 4px 0; color: #475569; font-size: 12px;">
            <strong>Emisor:</strong> ${docenteName || 'Coordinación Docente'} (Centro de Apoyo al Aprendizaje)
          </p>
          <p style="margin: 0; color: #475569; font-size: 12px;">
            <strong>Destinado a:</strong> ${contextTitle}
          </p>
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
          <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.6; white-space: pre-line;">
            ${message.trim()}
          </p>
        </div>

        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
          <p style="margin: 0; color: #166534; font-size: 12px; line-height: 1.4;">
            💡 Este es un comunicado oficial emitido por la coordinación académica para el seguimiento de tu trayectoria universitaria.
          </p>
        </div>

        <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-radius: 8px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; color: #64748b; font-size: 11px;">
            Dirección de Trayectoria Estudiantil • Universidad Finis Terrae
          </p>
        </div>
      </div>
    `;

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
          await transporter.sendMail({
            from: { name: fromName, address: config.user },
            to: `"${dest.name}" <${dest.email}>`,
            subject: `[UFT] ${subject.trim()}`,
            text: `Estimado/a ${dest.name},\n\n${message.trim()}\n\nEmitido por: ${docenteName || 'Coordinación Docente'}\nCentro de Apoyo al Aprendizaje UFT`,
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
