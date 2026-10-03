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

export const SURVEY_SCALE_OPTIONS = [
  { score: 1, label: '1. Siempre', shortLabel: 'Siempre', description: 'Me ocurre siempre' },
  { score: 2, label: '2. Casi siempre', shortLabel: 'Casi siempre', description: 'Me ocurre mucho' },
  { score: 3, label: '3. A veces', shortLabel: 'A veces', description: 'Me ocurre alguna vez' },
  { score: 4, label: '4. Pocas veces', shortLabel: 'Pocas veces', description: 'Me ocurre pocas veces o casi nunca' },
  { score: 5, label: '5. Nunca', shortLabel: 'Nunca', description: 'No me ocurre nunca' }
];

export const SATISFACTION_SURVEY_INSTRUCTIONS = 
  'A continuación se presenta una serie de enunciados sobre su forma de estudiar, lea atentamente cada uno de ellos y responda con total sinceridad marcando una opción.';

export const SATISFACTION_SURVEY_QUESTIONS = [
  { id: 1, title: 'Gestión de tareas', question: 'Cuando tengo que hacer una tarea, normalmente la dejo para el último minuto.' },
  { id: 2, title: 'Preparación de exámenes', question: 'Generalmente me preparo por adelantado para los exámenes.' },
  { id: 3, title: 'Búsqueda de ayuda', question: 'Cuando tengo problemas para entender algo, inmediatamente trato de buscar ayuda.' },
  { id: 4, title: 'Asistencia regular', question: 'Asisto regularmente a clases.' },
  { id: 5, title: 'Completitud de trabajos', question: 'Trato de completar el trabajo asignado lo más pronto posible.' },
  { id: 6, title: 'Postergación de trabajos', question: 'Postergo los trabajos de los cursos que no me gustan.' },
  { id: 7, title: 'Postergación de lecturas', question: 'Postergo las lecturas de los cursos que no me gustan.' },
  { id: 8, title: 'Mejora de hábitos', question: 'Constantemente intento mejorar mis hábitos de estudio.' },
  { id: 9, title: 'Dedicación y disciplina', question: 'Invierto el tiempo necesario en estudiar aun cuando el tema sea aburrido.' },
  { id: 10, title: 'Automotivación', question: 'Trato de motivarme para mantener mi ritmo de estudio.' },
  { id: 11, title: 'Anticipación en entregas', question: 'Trato de terminar mis trabajos importantes con tiempo de sobra.' },
  { id: 12, title: 'Revisión y prolijidad', question: 'Me tomo el tiempo de revisar mis tareas antes de entregarlas.' }
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

/**
 * Determina si una sesión de tutoría ya pasó su fecha/hora y debe considerarse archivada/finalizada.
 */
export function isSessionPast(session: { date: string; timeSlot?: string; isCompleted?: boolean }): boolean {
  if (!session || !session.date) return false;
  if (session.isCompleted) return true;

  try {
    const todayStr = getTodayDateStr();
    if (session.date < todayStr) return true;
    if (session.date > todayStr) return false;

    // Si la fecha es hoy, comparar contra el fin del bloque horario
    if (session.timeSlot) {
      const parts = session.timeSlot.split('-');
      const endTimeStr = (parts.length > 1 ? parts[1] : parts[0]).trim();
      const [endHours, endMinutes] = endTimeStr.split(':').map(Number);
      if (!isNaN(endHours) && !isNaN(endMinutes)) {
        const sessionEnd = new Date();
        sessionEnd.setHours(endHours, endMinutes, 0, 0);
        return Date.now() >= sessionEnd.getTime();
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Determina si una sesión sigue activa y vigente (no ha pasado su fecha y no está finalizada/archivada).
 */
export function isSessionActive(session: { date: string; timeSlot?: string; isCompleted?: boolean }): boolean {
  return !isSessionPast(session);
}

/**
 * Comprueba si el plazo de inscripción cerró (menos de 2 horas antes de iniciar o si la sesión ya pasó).
 */
export function isRegistrationWindowClosed(sessionDate: string, timeSlot?: string): boolean {
  try {
    if (!sessionDate) return true;
    const todayStr = getTodayDateStr();
    if (sessionDate < todayStr) return true;

    if (!timeSlot) return false;
    const startTimeStr = timeSlot.split('-')[0].trim();
    const [hours, minutes] = startTimeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return false;

    // Si es hoy o fecha futura, calcular diferencia en horas
    const [year, month, day] = sessionDate.split('-').map(Number);
    const sessionDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const diffMs = sessionDateTime.getTime() - Date.now();
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours < 2;
  } catch (e) {
    return false;
  }
}

// ==========================================
// CONTROL DE LÍMITE INSTITUCIONAL DE RESERVAS
// ==========================================

export const MAX_WEEKLY_ACTIVE_BOOKINGS = 5;

/**
 * Retorna la clave identificadora de semana (Lunes de esa semana en YYYY-MM-DD)
 */
export function getWeekKey(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = (date.getDay() + 6) % 7; // 0 = Lunes, 6 = Domingo
    const monday = new Date(date);
    monday.setDate(date.getDate() - day);
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const dayNum = String(monday.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayNum}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Obtiene las reservas activas de un estudiante para la semana de una fecha objetivo.
 */
export function getStudentActiveBookingsInWeek(sessions: Session[], studentId: string, targetDateStr: string): Session[] {
  const targetWeekKey = getWeekKey(targetDateStr);
  return sessions.filter(s => {
    if (!s.studentIds.includes(studentId)) return false;
    if (s.isCompleted || isSessionPast(s)) return false;
    if (s.attendance?.[studentId] === 'presente' || s.attendance?.[studentId] === 'ausente') return false;
    return getWeekKey(s.date) === targetWeekKey;
  });
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
