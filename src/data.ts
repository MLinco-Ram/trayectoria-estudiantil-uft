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
// PROTECCIÓN DE TUTORÍAS PERSONALIZADAS (1 A 1)
// ==========================================

export function isPersonalizedSession(session: Pick<Session, 'type' | 'maxSpots'>): boolean {
  return session.type === 'tutoria_personalizada' || session.type === 'psico_asesoria_individual' || session.maxSpots === 1;
}

/**
 * Una sesión personalizada creada para un estudiante solo puede verla e inscribirse ese estudiante.
 * Si se creó sin estudiante (cupo 1 a 1 libre), la ve cualquiera hasta que alguien la tome;
 * desde entonces queda reservada para quien se inscribió.
 */
export function canStudentAccessSession(session: Session, studentId: string, allSessions: Session[] = []): boolean {
  if (!isPersonalizedSession(session)) return true;
  const studentIds = session.studentIds || [];
  if (studentIds.includes(studentId) || session.reservedForStudentId === studentId) return true;
  if (session.reservedForStudentId || studentIds.length > 0) return false;
  // De un grupo de horarios ofrecidos el estudiante toma uno solo: tras inscribirse, los demás dejan de verse
  return !hasBookedOfferGroup(session, studentId, allSessions);
}

export function hasBookedOfferGroup(session: Session, studentId: string, allSessions: Session[]): boolean {
  if (!session.offerGroupId) return false;
  return allSessions.some(s => s.id !== session.id && s.offerGroupId === session.offerGroupId && (s.studentIds || []).includes(studentId));
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
// DESPACHO DE NOTIFICACIONES Y CORREOS
// ==========================================

export function triggerNotification(toEmail: string, toName: string, subject: string, message: string, htmlContent?: string) {
  const newNotif: WebNotification = {
    id: 'notif_' + Date.now(),
    toEmail,
    toName,
    subject,
    message,
    timestamp: new Date().toISOString(),
    read: false
  };
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

// "8:30 - 9:40" -> [510, 580] en minutos; null si no tiene ese formato
const parseSlotRange = (timeSlot: string): [number, number] | null => {
  const m = timeSlot.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
};

// Una sala no puede tener dos sesiones activas que se crucen en la misma fecha (bloques u hora exacta)
export const findRoomConflict = (sessions: Session[], location: string, date: string, timeSlot: string): Session | undefined => {
  const room = location.trim();
  const range = parseSlotRange(timeSlot);
  return sessions.find(s => {
    if (!s || s.isCompleted || s.date !== date || (s.location || '').trim() !== room) return false;
    const other = parseSlotRange(s.timeSlot);
    if (!range || !other) return s.timeSlot === timeSlot;
    return range[0] < other[1] && other[0] < range[1];
  });
};
