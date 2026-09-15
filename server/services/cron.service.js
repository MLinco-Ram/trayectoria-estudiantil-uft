import { getDb, getOrConnectDB } from '../db.js';
import { getEffectiveSmtpConfig, createTransporter } from './email.service.js';

export const checkAndSendTutorDailyReminders = async () => {
  const db = await getOrConnectDB();
  if (!db) return { sent: 0, message: "No DB connection" };

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const sessionsTomorrow = await db.collection('sessions').find({
      date: tomorrowStr,
      tutorId: { $ne: null }
    }).toArray();

    if (!sessionsTomorrow || sessionsTomorrow.length === 0) {
      return { sent: 0, message: `No hay tutorías agendadas para mañana (${tomorrowStr}).` };
    }

    const client = await createTransporter();
    const users = await db.collection('users').find({}).toArray();
    let sentCount = 0;

    for (const sess of sessionsTomorrow) {
      const tutor = users.find(u => u.id === sess.tutorId);
      if (!tutor || !tutor.email) continue;

      const registeredStudents = (sess.studentIds || []).map(stId => {
        const st = users.find(u => u.id === stId);
        return st ? `${st.name} (${st.career || 'Alumno'} - ${st.email || 'Sin correo'})` : stId;
      });

      const studentCount = (sess.studentIds || []).length;
      const subject = `Recordatorio: Tu tutoría de mañana "${sess.title}" (${studentCount} alumno${studentCount === 1 ? '' : 's'} inscrito${studentCount === 1 ? '' : 's'})`;
      
      const studentListHtml = registeredStudents.length > 0
        ? `<ul style="margin: 8px 0; padding-left: 20px; color: #1e293b;">${registeredStudents.map(s => `<li>${s}</li>`).join('')}</ul>`
        : `<p style="color: #64748b; font-style: italic;">Aún no hay alumnos inscritos en este bloque.</p>`;

      const textBody = `Estimado/a ${tutor.name},\n\nTe recordamos que mañana (${sess.date}) tienes programada una sesión de tutoría:\n\n• Actividad: ${sess.title}\n• Horario: ${sess.timeSlot}\n• Ubicación: ${sess.location}\n• Alumnos inscritos: ${studentCount}\n\nListado de alumnos:\n${registeredStudents.join('\n') || 'Sin inscritos aún'}\n\nPor favor conéctate o asiste puntualmente al espacio asignado.\n\nAtentamente,\nDirección de Trayectoria Estudiantil - Universidad Finis Terrae`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background-color: #092c4c; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 18px;">Universidad Finis Terrae</h2>
            <p style="color: #3a9ad9; margin: 4px 0 0; font-size: 12px; font-weight: bold; text-transform: uppercase;">Acompañamiento Académico - Trayectoria UFT</p>
          </div>
          
          <h3 style="color: #092c4c; font-size: 16px;">¡Hola, ${tutor.name}!</h3>
          <p style="color: #334155; font-size: 13px; line-height: 1.6;">
            Te recordamos que <strong>mañana</strong> tienes programada una sesión de tutoría con el siguiente detalle de asistencia:
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; color: #1e293b;">
            <p style="margin: 4px 0;">📚 <strong>Materia / Sesión:</strong> ${sess.title}</p>
            <p style="margin: 4px 0;">📅 <strong>Fecha:</strong> ${sess.date}</p>
            <p style="margin: 4px 0;">⏰ <strong>Horario:</strong> ${sess.timeSlot}</p>
            <p style="margin: 4px 0;">📍 <strong>Ubicación:</strong> ${sess.location}</p>
            <p style="margin: 8px 0 4px; font-size: 14px; color: #0284c7;">👥 <strong>Total de Alumnos Inscritos:</strong> <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 9999px; font-weight: bold;">${studentCount} alumno${studentCount === 1 ? '' : 's'}</span></p>
            <div style="margin-top: 10px; border-top: 1px dashed #cbd5e1; pt: 8px;">
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

      if (client) {
        try {
          await client.transporter.sendMail({
            from: { name: client.config.fromName || 'Trayectoria Estudiantil UFT', address: client.config.user },
            to: `"${tutor.name}" <${tutor.email}>`,
            subject: subject,
            text: textBody,
            html: htmlBody,
          });
          console.log(`[Auto-Reminder] Correo recordatorio enviado al tutor ${tutor.name} (${tutor.email}) para sesión ${sess.title}`);
          sentCount++;
        } catch (mErr) {
          console.error(`[Auto-Reminder] Error enviando correo al tutor ${tutor.email}:`, mErr);
        }
      } else {
        console.log(`[Auto-Reminder Simulado] Recordatorio 1 día antes para tutor ${tutor.name} (${tutor.email}) con ${studentCount} alumnos.`);
        sentCount++;
      }
    }

    return { sent: sentCount, message: `Se enviaron ${sentCount} recordatorios a tutores para las tutorías de mañana (${tomorrowStr}).` };
  } catch (err) {
    console.error("[Auto-Reminder] Error general:", err);
    return { error: err.message };
  }
};

export const startCronJobs = () => {
  // Intervalo cada hora
  setInterval(async () => {
    await checkAndSendTutorDailyReminders();
  }, 1000 * 60 * 60);
};
