import { User, Session, IssueReport, WebNotification, UserAvailability, StudentRequest, DictionaryEntry } from './types';

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
  { code: 'ANS', name: 'Control de Ansiedad', program: 'psicoeducativo' },
  { code: 'AUTO', name: 'Autorregulación', program: 'psicoeducativo' },
  { code: 'NEUR', name: 'Neuro herramientas', program: 'psicoeducativo' },
  { code: 'MOTI', name: 'Motivación', program: 'psicoeducativo' },
  { code: 'EVOR', name: 'Evaluaciones orales', program: 'psicoeducativo' },
  { code: 'OTRO', name: 'Otro', program: 'psicoeducativo' },
  { code: 'COMU', name: 'Actividad para la comunidad', program: 'comunidad' },
  { code: 'COMO', name: 'Otro', program: 'comunidad' }
];

// Etiquetas de cada programa para toda la interfaz
export const PROGRAM_LABELS: Record<string, { full: string; short: string; emoji: string }> = {
  tutorias: { full: 'Programa de Tutorías Académicas', short: 'Tutorías', emoji: '🎯' },
  psicoeducativo: { full: 'Programa de Apoyo Psicoeducativo', short: 'Psicoeducativo', emoji: '🧠' },
  comunidad: { full: 'Actividades para la Comunidad', short: 'Comunidad', emoji: '🤝' }
};
export const BASE_PROGRAM_KEYS = ['tutorias', 'psicoeducativo', 'comunidad'];

// ==========================================
// DICCIONARIO EDITABLE (materias/áreas y programas adicionales, desde MongoDB)
// ==========================================
let customPrograms: DictionaryEntry[] = [];
let customSubjects: DictionaryEntry[] = [];

/** Registra lo que devuelve /api/dictionary; los componentes lo leen al renderizar. */
export function setDictionary(entries: DictionaryEntry[]) {
  customPrograms = entries.filter(e => e.kind === 'program' && e.key);
  customSubjects = entries.filter(e => e.kind === 'subject' && e.program);
}

/** Programas base + programas creados en el Diccionario. */
export function getPrograms(): { key: string; label: string; custom: boolean }[] {
  return [
    ...BASE_PROGRAM_KEYS.map(key => ({ key, label: PROGRAM_LABELS[key].full, custom: false })),
    ...customPrograms.map(p => ({ key: p.key as string, label: p.name, custom: true }))
  ];
}

export const getCustomPrograms = () => customPrograms.map(p => ({ key: p.key as string, label: p.name }));

/** Materias/áreas de un programa: las fijas + las agregadas en el Diccionario. */
export function getSubjects(program: string): { code: string; name: string; program: string; custom?: boolean }[] {
  const base = SUBJECTS.filter(s => s.program === program);
  const extra = customSubjects.filter(s => s.program === program).map(s => ({ code: s.id, name: s.name, program, custom: true }));
  return [...base, ...extra];
}

export const programLabel = (p?: string, kind: 'full' | 'short' = 'full') => {
  if (p && PROGRAM_LABELS[p]) return PROGRAM_LABELS[p][kind];
  const custom = customPrograms.find(c => c.key === p);
  return custom ? custom.name : (p || PROGRAM_LABELS.psicoeducativo[kind]);
};

// Carreras de pregrado UFT agrupadas por facultad (fuente: admision.finis.cl/carreras, nov 2026)
export const UFT_CAREERS: { faculty: string; careers: string[] }[] = [
  { faculty: 'Arquitectura, Diseño y Estudios Creativos', careers: ['Arquitectura', 'Diseño', 'Diseño de Moda & Management', 'Doble Título Publicidad y Diseño', 'Publicidad'] },
  { faculty: 'Artes', careers: ['Actuación y Creación Teatral', 'Bachillerato en Artes, Arquitectura y Diseño', 'Licenciatura en Artes Visuales'] },
  { faculty: 'Derecho', careers: ['Derecho'] },
  { faculty: 'Economía y Negocios', careers: ['Contador Auditor', 'Dirección y Gestión de Artes Culinarias', 'Ingeniería Comercial', 'Ingeniería en Información y Control de Gestión'] },
  { faculty: 'Educación y Ciencias Sociales', careers: ['Administración Pública', 'Bachillerato en Ciencias Sociales', 'Ciencia Política', 'Pedagogía en Educación Básica', 'Pedagogía en Educación Parvularia', 'Programa de Formación Pedagógica en Educación Media', 'Psicología', 'Sociología'] },
  { faculty: 'Humanidades y Comunicaciones', careers: ['Bachillerato en Humanidades', 'Dirección Editorial', 'Gestión Cultural y Patrimonio', 'Licenciatura en Historia', 'Licenciatura en Literatura', 'Periodismo y Comunicación'] },
  { faculty: 'Ingeniería', careers: ['Ingeniería Civil Biomédica', 'Ingeniería Civil en Inteligencia Artificial y Realidad Virtual', 'Ingeniería Civil Industrial', 'Ingeniería Civil Informática y Telecomunicaciones'] },
  { faculty: 'Medicina y Salud', careers: ['Bachillerato en Medicina y Ciencias Biomédicas', 'Enfermería', 'Kinesiología', 'Medicina', 'Nutrición y Dietética', 'Odontología'] }
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

// Encuesta genérica de talleres psicoeducativos (Google Form oficial de Trayectoria)
export const WORKSHOP_SURVEY_INSTRUCTIONS =
  'La participación es voluntaria. Tus respuestas serán tratadas de manera confidencial y analizadas de forma agrupada. No hay respuestas buenas ni malas; responde según tu experiencia real. Si tienes alguna duda puedes contactarte con trayectorias@uft.cl';

export const WORKSHOP_SCALE_OPTIONS = [
  { score: 1, label: '1. Muy en desacuerdo', shortLabel: 'Muy en desac.', description: 'Muy en desacuerdo' },
  { score: 2, label: '2. En desacuerdo', shortLabel: 'En desac.', description: 'En desacuerdo' },
  { score: 3, label: '3. Neutral', shortLabel: 'Neutral', description: 'Ni de acuerdo ni en desacuerdo' },
  { score: 4, label: '4. De acuerdo', shortLabel: 'De acuerdo', description: 'De acuerdo' },
  { score: 5, label: '5. Muy de acuerdo', shortLabel: 'Muy de ac.', description: 'Muy de acuerdo' }
];

export const WORKSHOP_SURVEY_QUESTIONS = [
  { id: 1, title: 'Relevancia', question: 'El taller abordó necesidades relevantes para mi vida académica.' },
  { id: 2, title: 'Claridad', question: 'Los contenidos fueron claros y fáciles de comprender.' },
  { id: 3, title: 'Aplicación', question: 'Las actividades realizadas ayudaron a aplicar lo trabajado.' },
  { id: 4, title: 'Autoeficacia', question: 'Después del taller me siento más capaz de aplicar al menos una estrategia revisada.' },
  { id: 5, title: 'Satisfacción', question: 'En general, quedé satisfecho/a con el taller.' },
  { id: 6, title: 'Recomendación', question: 'Recomendaría este taller a otros/as estudiantes.' }
];

export const WORKSHOP_SUPPORT_OPTIONS = [
  'No, por ahora no',
  'Sí, apoyo académico/tutoría',
  'Sí, apoyo psicoeducativo'
];

export const WORKSHOP_OPEN_QUESTIONS = [
  { key: 'mostUseful', label: '¿Qué fue lo más útil del taller?' },
  { key: 'relatorPositive', label: '¿Qué aspectos positivos rescatas del/la relator(a) durante el taller?' },
  { key: 'relatorImprove', label: '¿Qué recomendarías mejorar al relator(a) para una próxima versión del taller?' }
] as const;

// Encuesta de tutorías colectivas: misma estructura que la de talleres, enfocada en la tutoría par grupal
export const TUTORING_SURVEY_INSTRUCTIONS =
  'La participación es voluntaria. Tus respuestas son confidenciales y se analizan de forma agrupada para mejorar las tutorías colectivas. No hay respuestas buenas ni malas; responde según tu experiencia en esta sesión. Si tienes dudas puedes escribir a trayectorias@uft.cl';

export const TUTORING_SURVEY_QUESTIONS = [
  { id: 1, title: 'Pertinencia', question: 'La tutoría abordó contenidos o dudas relevantes para mi asignatura.' },
  { id: 2, title: 'Claridad', question: 'El/la tutor(a) explicó los contenidos de forma clara y ordenada.' },
  { id: 3, title: 'Práctica', question: 'Los ejercicios realizados me ayudaron a practicar lo revisado.' },
  { id: 4, title: 'Trabajo en grupo', question: 'Trabajar con otros/as compañeros/as en la sesión enriqueció mi aprendizaje.' },
  { id: 5, title: 'Preparación', question: 'Después de la tutoría me siento mejor preparado/a para mis evaluaciones.' },
  { id: 6, title: 'Recomendación', question: 'Recomendaría esta tutoría colectiva a otros/as estudiantes.' }
];

export const TUTORING_SUPPORT_OPTIONS = [
  'No, por ahora no',
  'Sí, más tutorías colectivas de esta asignatura',
  'Sí, una tutoría personalizada (1 a 1)',
  'Sí, apoyo psicoeducativo'
];

export const TUTORING_OPEN_QUESTIONS = [
  { key: 'mostUseful', label: '¿Qué contenido o ejercicio de la tutoría te resultó más útil?' },
  { key: 'relatorPositive', label: '¿Qué aspectos positivos rescatas del/la tutor(a) durante la sesión?' },
  { key: 'relatorImprove', label: '¿Qué recomendarías mejorar al tutor(a) para una próxima tutoría?' }
] as const;

export type SurveyKind = 'habitos' | 'taller' | 'tutoria';

/** Las sesiones grupales psicoeducativas/comunidad usan la encuesta de talleres; las tutorías colectivas, la de tutorías. */
export const getSurveyKind = (s: { program?: string; type?: string }): SurveyKind => {
  if (s.program && s.program !== 'tutorias' && s.type !== 'psico_asesoria_individual') return 'taller';
  if (s.program === 'tutorias' && s.type === 'tutoria_general') return 'tutoria';
  return 'habitos';
};

export const getSurveyConfigByKind = (kind: SurveyKind = 'habitos', program?: string) => {
  if (kind === 'taller') return {
    kind, title: program === 'comunidad' ? 'Encuesta Actividad para la Comunidad' : program === 'psicoeducativo' || !program ? 'Encuesta Taller Psicoeducativo' : `Encuesta ${programLabel(program)}`,
    subtitle: 'Evaluación del taller y del relator/a', instructions: WORKSHOP_SURVEY_INSTRUCTIONS,
    questions: WORKSHOP_SURVEY_QUESTIONS, scale: WORKSHOP_SCALE_OPTIONS,
    supportOptions: WORKSHOP_SUPPORT_OPTIONS, openQuestions: WORKSHOP_OPEN_QUESTIONS,
    commentLabel: 'Comentarios o sugerencias sobre el taller (Opcional):'
  };
  if (kind === 'tutoria') return {
    kind, title: 'Encuesta Tutoría Colectiva',
    subtitle: 'Evaluación de la tutoría y del tutor/a', instructions: TUTORING_SURVEY_INSTRUCTIONS,
    questions: TUTORING_SURVEY_QUESTIONS, scale: WORKSHOP_SCALE_OPTIONS,
    supportOptions: TUTORING_SUPPORT_OPTIONS, openQuestions: TUTORING_OPEN_QUESTIONS,
    commentLabel: 'Comentarios o sugerencias sobre la tutoría (Opcional):'
  };
  return {
    kind: 'habitos' as SurveyKind, title: 'Encuesta de Hábitos y Satisfacción',
    subtitle: 'Diagnóstico de hábitos de estudio y calidad académica', instructions: SATISFACTION_SURVEY_INSTRUCTIONS,
    questions: SATISFACTION_SURVEY_QUESTIONS, scale: SURVEY_SCALE_OPTIONS,
    supportOptions: [] as string[], openQuestions: [] as readonly { key: 'mostUseful' | 'relatorPositive' | 'relatorImprove'; label: string }[],
    commentLabel: 'Comentarios u observaciones adicionales sobre la sesión (Opcional):'
  };
};

export const getSurveyConfig = (s: { program?: string; type?: string }) => getSurveyConfigByKind(getSurveyKind(s), s.program);

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
 * La asistencia solo se puede pasar el mismo día de la clase (a cualquier hora de ese día).
 * Evita que una sesión futura quede marcada como finalizada/archivada al tomar asistencia antes de tiempo.
 */
export function canTakeAttendance(session: { date: string; timeSlot?: string }): boolean {
  return !!session?.date && session.date === getTodayDateStr();
}

/** Horas de anticipación con que cierra la inscripción de los estudiantes. */
export const REGISTRATION_CLOSE_HOURS_BEFORE = 1;

/**
 * Comprueba si el plazo de inscripción cerró (menos de 1 hora antes de iniciar o si la sesión ya pasó).
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

    return diffHours < REGISTRATION_CLOSE_HOURS_BEFORE;
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
