import { User, Session, IssueReport, WebNotification, UserAvailability, StudentRequest } from './types';

// ==========================================
// CONSTANTES INSTITUCIONALES UFT (SIN MOCKS)
// ==========================================

export const TIME_SLOTS = [
  '8:30 - 9:40',
  '9:50 - 11:00',
  '11:10 - 12:20',
  '12:30 - 13:40',
  '13:50 - 15:00',
  '15:10 - 16:20',
  '16:30 - 17:40'
];

export const SUBJECTS = [
  { code: 'MAT', name: 'Matemática', program: 'tutorias' },
  { code: 'PROG', name: 'Programación', program: 'tutorias' },
  { code: 'DER', name: 'Derecho', program: 'tutorias' },
  { code: 'TIEM', name: 'Manejo del Tiempo', program: 'psicoeducativo' },
  { code: 'EST', name: 'Estrategias de Estudio', program: 'psicoeducativo' },
  { code: 'ANS', name: 'Control de Ansiedad', program: 'psicoeducativo' }
];

export const SATISFACTION_SURVEY_QUESTIONS = [
  { id: 1, title: 'Claridad en las explicaciones', question: '¿El tutor/docente explicó los conceptos y temas de manera clara y comprensible?' },
  { id: 2, title: 'Dominio de los contenidos', question: '¿El tutor/docente demostró un adecuado dominio y conocimiento de la materia tratada?' },
  { id: 3, title: 'Puntualidad y cumplimiento', question: '¿La sesión inició y finalizó puntualmente conforme al horario programado?' },
  { id: 4, title: 'Resolución de dudas', question: '¿Se promovió la participación y se respondieron adecuadamente las dudas formuladas?' },
  { id: 5, title: 'Materiales y recursos', question: '¿Los materiales de apoyo, ejercicios o recursos utilizados fueron útiles y pertinentes?' },
  { id: 6, title: 'Estructura y organización', question: '¿La sesión contó con un orden claro, estructurado y enfocado en los objetivos académicos?' },
  { id: 7, title: 'Trato y disposición', question: '¿El trato brindado por el tutor/docente fue cordial, respetuoso y empático?' },
  { id: 8, title: 'Aporte al aprendizaje', question: '¿Esta sesión contribuyó significativamente a mejorar tu comprensión de la asignatura o temática?' },
  { id: 9, title: 'Ritmo y dinamismo', question: '¿El ritmo de trabajo y la dinámica empleada fueron adecuados para facilitar el aprendizaje?' },
  { id: 10, title: 'Aplicación práctica', question: '¿Se desarrollaron ejercicios o casos prácticos aplicables a las evaluaciones del curso?' },
  { id: 11, title: 'Cumplimiento de expectativas', question: '¿La sesión cumplió con tus expectativas iniciales para este contenido o taller?' },
  { id: 12, title: 'Recomendación general', question: '¿Recomendarías asistir a estas tutorías/talleres a otros compañeros de la carrera?' }
];

// Arreglos vacíos por defecto (toda la data proviene exclusivamente de MongoDB Atlas)
export const MOCK_USERS: User[] = [];
export const INITIAL_SESSIONS: Session[] = [];
export const DEFAULT_AVAILABILITIES: UserAvailability[] = [];
export const DEFAULT_STUDENT_REQUESTS: StudentRequest[] = [];

// ==========================================
// HELPERS DE FECHAS DINÁMICAS
// ==========================================

export function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRelativeDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDynamicPresetDates(count = 5): string[] {
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    list.push(getRelativeDateStr(i));
  }
  return list;
}

// ==========================================
// HELPERS DE CACHÉ LOCAL (SOLO SINCRONIZADA CON MONGO)
// ==========================================

export function getSavedUsers(): User[] {
  const data = localStorage.getItem('uft_te_users');
  return data ? JSON.parse(data) : [];
}

export function saveUsers(users: User[]) {
  localStorage.setItem('uft_te_users', JSON.stringify(users));
}

export function getSavedSessions(): Session[] {
  const data = localStorage.getItem('uft_te_sessions');
  return data ? JSON.parse(data) : [];
}

export function saveSessions(sessions: Session[]) {
  localStorage.setItem('uft_te_sessions', JSON.stringify(sessions));
}

export function getSavedReports(): IssueReport[] {
  const data = localStorage.getItem('uft_te_reports');
  return data ? JSON.parse(data) : [];
}

export function saveReports(reports: IssueReport[]) {
  localStorage.setItem('uft_te_reports', JSON.stringify(reports));
}

export function getSavedNotifications(): WebNotification[] {
  const data = localStorage.getItem('uft_te_notifications');
  return data ? JSON.parse(data) : [];
}

export function saveNotifications(notifications: WebNotification[]) {
  localStorage.setItem('uft_te_notifications', JSON.stringify(notifications));
}

export function getSavedAvailabilities(): UserAvailability[] {
  const data = localStorage.getItem('uft_te_availabilities');
  return data ? JSON.parse(data) : [];
}

export function saveAvailabilities(availabilities: UserAvailability[]) {
  localStorage.setItem('uft_te_availabilities', JSON.stringify(availabilities));
}

export function getSavedStudentRequests(): StudentRequest[] {
  const data = localStorage.getItem('uft_te_student_requests');
  return data ? JSON.parse(data) : [];
}

export function saveStudentRequests(requests: StudentRequest[]) {
  localStorage.setItem('uft_te_student_requests', JSON.stringify(requests));
}

export function getSavedSmtpSettings(): any {
  const data = localStorage.getItem('uft_te_smtp_settings');
  return data ? JSON.parse(data) : null;
}

export function saveSmtpSettings(settings: any) {
  localStorage.setItem('uft_te_smtp_settings', JSON.stringify(settings));
}

// ==========================================
// DESPACHO DE NOTIFICACIONES Y CORREOS
// ==========================================

export function triggerNotification(toEmail: string, toName: string, subject: string, message: string, htmlContent?: string) {
  const notifs = getSavedNotifications();
  const newNotif: WebNotification = {
    id: 'notif_' + Date.now(),
    toEmail,
    toName,
    subject,
    message,
    timestamp: new Date().toISOString(),
    read: false
  };
  notifs.unshift(newNotif);
  saveNotifications(notifs);

  // Guardar en MongoDB Atlas
  fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newNotif)
  }).catch(() => {});

  // Despachar correo institucional a través de SMTP backend
  fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: toEmail,
      toName,
      subject,
      text: message,
      html: htmlContent
    }),
  }).catch((err) => {
    console.error('Error al despachar correo:', err);
  });

  return newNotif;
}

// Formateo de RUT Chileno (Permite escribir 'admin' o RUT con formato)
export function formatRut(rut: string): string {
  if (!rut) return '';
  const trimmed = rut.trim();
  const lower = trimmed.toLowerCase();

  // Si empieza con letras (ej: admin, Administrador, etc.) no forzar formato numérico de RUT
  if (/^[a-zA-Z]/.test(trimmed) || lower.startsWith('admin') || 'admin'.startsWith(lower)) {
    return rut;
  }

  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length <= 1) return clean;
  if (clean.length > 9) return clean.slice(0, 9);
  
  const dv = clean.slice(-1);
  const cuerpo = clean.slice(0, -1);
  
  let formatted = '';
  let count = 0;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    formatted = cuerpo[i] + formatted;
    count++;
    if (count % 3 === 0 && i !== 0) {
      formatted = '.' + formatted;
    }
  }
  return `${formatted}-${dv}`;
}
