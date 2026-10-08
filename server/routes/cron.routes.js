import { Router } from 'express';
import nodemailer from 'nodemailer';
import { checkAndSendTutorDailyReminders } from '../services/cron.service.js';
import { getEffectiveSmtpConfig } from '../services/email.service.js';

const router = Router();

// Endpoint para gatillar o probar el recordatorio de 1 día antes a los tutores
router.post('/cron/remind-tutors', async (req, res) => {
  const { targetTutorEmail } = req.body || {};
  const db = req.db;
  
  if (targetTutorEmail) {
    try {
      const config = await getEffectiveSmtpConfig();
      if (!config) {
        return res.status(400).json({ error: "No hay configuración SMTP activa para enviar el correo." });
      }

      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.pass },
      });

      const sampleSession = await db.collection('sessions').findOne({ tutorId: { $ne: null } }) || {
        title: 'Tutoría de Cálculo y Álgebra Lineal',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        timeSlot: '10:30 - 12:00',
        location: 'Cubículo 3B - Edificio Central',
        studentIds: ['alumno_1', 'alumno_2']
      };

      const users = await db.collection('users').find({}).toArray();
      const registeredStudents = (sampleSession.studentIds || []).map(stId => {
        const st = users.find(u => u.id === stId);
        return st ? `${st.name} (${st.career || 'Alumno'} - ${st.email || 'Sin correo'})` : stId;
      });

      const studentCount = sampleSession.studentIds?.length || 2;
      const subject = `[PRUEBA] Recordatorio: Tu tutoría de mañana "${sampleSession.title}" (${studentCount} alumnos inscritos)`;
      
      const studentListHtml = registeredStudents.length > 0
        ? `<ul style="margin: 8px 0; padding-left: 20px; color: #1e293b;">${registeredStudents.map(s => `<li>${s}</li>`).join('')}</ul>`
        : `<p style="color: #64748b; font-style: italic;">Aún no hay alumnos inscritos en este bloque.</p>`;

      const textBody = `Estimado/a Tutor/a,\n\nEste es un correo de prueba del sistema de recordatorio automático (1 día antes):\n\n• Actividad: ${sampleSession.title}\n• Horario: ${sampleSession.timeSlot}\n• Ubicación: ${sampleSession.location}\n• Total Alumnos inscritos: ${studentCount}\n\nListado de alumnos:\n${registeredStudents.join('\n')}\n\nPor favor conéctate o asiste puntualmente al espacio asignado.\n\nAtentamente,\nDirección de Trayectoria Estudiantil - Universidad Finis Terrae`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background-color: #092c4c; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 18px;">Universidad Finis Terrae</h2>
            <p style="color: #3a9ad9; margin: 4px 0 0; font-size: 12px; font-weight: bold; text-transform: uppercase;">Acompañamiento Académico - Trayectoria UFT</p>
          </div>
          
          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 14px; margin-bottom: 16px; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; color: #1e40af; font-weight: bold;">
              🔔 Prueba en Vivo: Recordatorio de Tutoría (Simulación de 1 día antes)
            </p>
          </div>

          <h3 style="color: #092c4c; font-size: 16px;">¡Hola, Tutor(a)!</h3>
          <p style="color: #334155; font-size: 13px; line-height: 1.6;">
            Te recordamos que <strong>mañana</strong> tienes programada una sesión de tutoría con el siguiente detalle de asistencia:
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; color: #1e293b;">
            <p style="margin: 4px 0;">📚 <strong>Materia / Sesión:</strong> ${sampleSession.title}</p>
            <p style="margin: 4px 0;">📅 <strong>Fecha:</strong> ${sampleSession.date}</p>
            <p style="margin: 4px 0;">⏰ <strong>Horario:</strong> ${sampleSession.timeSlot}</p>
            <p style="margin: 4px 0;">📍 <strong>Ubicación:</strong> ${sampleSession.location}</p>
            <p style="margin: 8px 0 4px; font-size: 14px; color: #0284c7;">👥 <strong>Total de Alumnos Inscritos:</strong> <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 9999px; font-weight: bold;">${studentCount} alumnos</span></p>
            <div style="margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
              <strong>Nómina de Estudiantes:</strong>
              ${studentListHtml}
            </div>
          </div>

          <p style="color: #64748b; font-size: 12px;">
            Recuerda ingresar al portal de tutores tras la sesión para marcar el pase de lista correspondiente.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center;">
            Dirección de Trayectoria Estudiantil • Universidad Finis Terrae
          </p>
        </div>
      `;

      const info = await transporter.sendMail({
        from: { name: config.fromName || 'Trayectoria Estudiantil UFT', address: config.user },
        to: targetTutorEmail,
        subject: subject,
        text: textBody,
        html: htmlBody,
      });

      return res.json({
        success: true,
        message: `¡Correo de recordatorio de tutoría enviado exitosamente a ${targetTutorEmail}!`,
        messageId: info.messageId
      });
    } catch (err) {
      console.error("[Remind-Test-Error]:", err);
      return res.status(500).json({ error: "Error enviando correo de recordatorio al tutor", details: err.message });
    }
  }

  const result = await checkAndSendTutorDailyReminders();
  res.json(result);
});

// Endpoint de prueba para enviar la alerta de inconveniente de alumno a los docentes
router.post('/test/student-inconvenience-alert', async (req, res) => {
  const { targetEmail, studentName, career, preferredTime, message } = req.body || {};
  const db = req.db;

  try {
    const config = await getEffectiveSmtpConfig();
    if (!config) {
      return res.status(400).json({ error: "No hay configuración SMTP activa para enviar el correo." });
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });

    const stName = studentName || 'Constanza Morales';
    const stCareer = career || 'Ingeniería Comercial';
    const stRut = '20.123.456-7';
    const stEmail = 'constanza.morales@mail.uft.cl';
    const stTime = preferredTime || 'Lunes o Miércoles de 16:00 a 18:00';
    const stMsg = message || 'Tengo un choque de horario con la cátedra de Finanzas II los días martes. Solicito un horario flexible o tutoría individual.';
    const progLabel = 'Programa de Tutorías Académicas';
    const subject = `[PRUEBA] [Trayectoria UFT] Nueva Solicitud de Tope Horario / Inconveniente: ${stName}`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 30px 15px; min-height: 100%;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <tr>
            <td style="background: linear-gradient(135deg, #092c4c 0%, #153a5c 100%); padding: 30px 25px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Trayectoria <span style="color: #3a9ad9;">UFT.</span></h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Coordinación Docente</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 35px 30px 20px 30px;">
              <div style="text-align: center; margin-bottom: 25px;">
                <span style="background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 9999px; display: inline-block; letter-spacing: 0.5px;">
                  ⚠️ Prueba en Vivo: Aviso de Inconveniente de Alumno para Docentes
                </span>
              </div>

              <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">
                Estimados Docentes y Coordinadores,
              </h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 25px 0;">
                El estudiante <strong>${stName}</strong> ha presentado un aviso formal por inconveniente / tope de horario y solicita la coordinación de un horario flexible individual.
              </p>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 14px 0; color: #092c4c; font-size: 15px; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
                  Ficha de la Solicitud
                </h3>
                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>Estudiante:</strong> ${stName}</p>
                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>RUT:</strong> ${stRut}</p>
                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>Carrera:</strong> ${stCareer}</p>
                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>Correo Alumno:</strong> ${stEmail}</p>
                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>Programa Solicitado:</strong> ${progLabel}</p>
                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>Disponibilidad Propuesta por Alumno:</strong> <span style="color: #0284c7; font-weight: 700;">${stTime}</span></p>
              </div>

              <div style="background-color: #f1f5f9; border-left: 4px solid #3a9ad9; padding: 14px 16px; border-radius: 4px; margin-bottom: 25px;">
                <p style="margin: 0 0 6px 0; color: #092c4c; font-size: 12px; font-weight: 700;">
                  Mensaje / Motivo del Inconveniente:
                </p>
                <p style="margin: 0; color: #334155; font-size: 13px; line-height: 1.5; font-style: italic;">
                  "${stMsg}"
                </p>
              </div>

              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
                Pueden revisar y gestionar esta solicitud directamente desde su panel docente en la pestaña <strong>Horarios Flexibles</strong> &gt; <strong>Bandeja de Inconvenientes</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 11px;">Centro de Apoyo al Aprendizaje y Trayectoria Estudiantil • Universidad Finis Terrae</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    let destinations = [];
    if (targetEmail && targetEmail.trim()) {
      destinations = [targetEmail.trim()];
    } else {
      const users = await db.collection('users').find({ role: 'docente' }).toArray();
      destinations = users.map(u => u.email).filter(Boolean);
    }

    if (destinations.length === 0) {
      return res.status(400).json({ error: "No se encontraron correos de docentes destinatarios." });
    }

    let sent = 0;
    for (const dest of destinations) {
      await transporter.sendMail({
        from: { name: config.fromName || 'Trayectoria Estudiantil UFT', address: config.user },
        to: dest,
        subject: subject,
        text: `Nueva solicitud de inconveniente de ${stName} (${stCareer}):\n"${stMsg}"\nDisponibilidad: ${stTime}`,
        html: htmlBody,
      });
      sent++;
    }

    res.json({
      success: true,
      message: `¡Alerta de inconveniente enviada exitosamente a ${sent} docente(s): ${destinations.join(', ')}!`
    });
  } catch (err) {
    console.error("[Inconvenience-Alert-Test-Error]:", err);
    res.status(500).json({ error: "Error enviando alerta de inconveniente a los docentes", details: err.message });
  }
});

export default router;
