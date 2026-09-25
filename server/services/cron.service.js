import { getDb, getOrConnectDB } from '../db.js';
import { getEffectiveSmtpConfig, createTransporter, formatMinimalEmail } from './email.service.js';

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

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const actionUrl = `${baseUrl}/tutor`;
      const summaryText = `Te recordamos que tienes una sesión de tutoría programada para mañana (${sess.date}). Ingresa a la plataforma para revisar los detalles completos, la nómina de estudiantes y pasar asistencia.`;

      const htmlBody = formatMinimalEmail({
        toName: tutor.name,
        subject,
        summary: summaryText,
        actionUrl,
        actionText: 'Ver Tutoría en la Plataforma'
      });

      const textBody = `Hola ${tutor.name},\n\n${summaryText}\n\nIngresa aquí: ${actionUrl}`;

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
