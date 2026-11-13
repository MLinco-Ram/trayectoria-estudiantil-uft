export type Role = 'docente' | 'tutor' | 'alumno' | 'admin';
export type TutorType = 'tutor_par' | 'tutor_de_tutores';

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  rut: string;
  role: Role; // Rol activo en la sesión actual
  roles?: Role[]; // Lista completa de roles asignados al usuario (multi-rol, ej: ['alumno', 'tutor'])
  tutorType?: TutorType; // Subrol activo de tutor en la sesión actual ('tutor_par' | 'tutor_de_tutores')
  tutorTypes?: TutorType[]; // Subroles de tutor asignados (ej: ['tutor_par', 'tutor_de_tutores'])
  assignedTutorIds?: string[]; // IDs de tutores pares supervisados por este Tutor de Tutores
  email: string;
  career?: string; // Optional career for student/tutor
  password?: string; // Optional password for registered users
  createdAt?: string; // Fecha y hora de registro (ISO)
  tutorialsSeen?: string[]; // Tutoriales ya vistos (ej. 'alumno', 'tutor:par', 'docente:calendar')
  mustChangePassword?: boolean; // Cuenta creada por staff: debe cambiar la contraseña inicial en el primer ingreso
}

// Programas base + los creados en el Diccionario (clave en minúsculas, ej: 'talleres_de_verano')
export type ProgramType = 'tutorias' | 'psicoeducativo' | 'comunidad' | (string & {});

export type SessionType = 
  | 'tutoria_general' 
  | 'tutoria_personalizada' 
  | 'psico_taller' 
  | 'psico_asesoria_individual'
  | 'induccion'
  | 'clase_magistral'
  | 'taller_ampliado'
  | 'actividad_comunidad'
  | 'actividad_grupal';

export interface SessionFeedback {
  studentId: string;
  studentName?: string;
  rating: number; // 1 to 5 stars (promedio general)
  answers?: Record<number, number>; // questionId (1..12) -> score (1..5)
  comment: string;
  createdAt: string;
  surveyKind?: 'habitos' | 'taller' | 'tutoria';
  // Solo encuestas de talleres y de tutorías colectivas
  mostUseful?: string;
  additionalSupport?: string;
  relatorPositive?: string;
  relatorImprove?: string;
}

export interface Session {
  id: string;
  program: ProgramType;
  type: SessionType;
  reservedForStudentId?: string; // Sesión personalizada: único estudiante que puede verla e inscribirse
  offerGroupId?: string; // Horarios ofrecidos juntos para una sesión 1 a 1: el estudiante toma solo uno del grupo
  title: string;
  subject?: string; // e.g. "Matemática", "Programación", "Derecho", "Manejo del Tiempo"
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "09:00 - 10:30", "10:30 - 12:00", etc.
  docenteId: string;
  tutorId: string | null; // Null if general, assigned tutor if personalized
  studentIds: string[]; // List of student IDs registered
  maxSpots: number; // e.g. 20 for general/talleres, 1 for personalized/asesoria
  location: string; // Sala 302, Virtual Teams, etc.
  attendance: Record<string, 'presente' | 'ausente' | 'pendiente'>; // studentId -> status
  isCompleted?: boolean;
  ratings?: Record<string, SessionFeedback>; // studentId -> feedback
  syllabus?: string; // Cronograma / Temario / Plan de trabajo asignado por el tutor
}

export interface IssueReport {
  id: string;
  sessionId: string;
  tutorId: string;
  description: string;
  requestType: 'reasignar_horario' | 'reasignar_tutor' | 'otro';
  proposedTime?: string;
  suggestedTutorId?: string;
  suggestedTutorName?: string;
  status: 'pendiente' | 'resuelto';
  createdAt: string;
  resolvedAt?: string;
  resolutionNote?: string; // Resumen de la decisión tomada por coordinación
}

export interface WebNotification {
  id: string;
  toEmail: string;
  toName: string;
  subject: string;
  message: string;
  timestamp: string;
  read: boolean;
  fromName?: string; // Quién envió el comunicado (si aplica)
}

export interface UserAvailability {
  userId: string;
  role: 'alumno' | 'tutor';
  userName: string;
  career: string;
  days: {
    day: string; // e.g. "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"
    slots: string[]; // e.g. ["09:00 - 10:30", "12:00 - 13:30"]
  }[];
  updatedAt: string;
}

export interface StudentRequest {
  id: string;
  studentId: string;
  studentName: string;
  studentCareer: string;
  program: ProgramType;
  message: string;
  preferredTime: string; // e.g. "Miércoles en la tarde (16:30)"
  conflictSessionId?: string; // Reserva con tope: al resolver la solicitud el estudiante se desinscribe de ella
  conflictSessionLabel?: string; // Texto de esa reserva al momento de enviar (título, fecha y bloque)
  status: 'pendiente' | 'resuelto';
  assignedSessionId?: string; // If resolved with a newly created session
  resolvedAt?: string;
  createdAt: string;
}


// Destinatarios de un comunicado docente
export type BroadcastScope =
  | 'all_community'
  | 'all_students'
  | 'all_tutors'
  | 'specific_session'
  | 'specific_tutor_par'
  | 'specific_tutor_de_tutores'
  | 'specific_student';

export interface DictionaryEntry {
  id: string;
  kind: 'subject' | 'program';
  name: string;
  key?: string; // Solo programas: clave usada en Session.program
  program?: string; // Solo materias/áreas: programa al que pertenecen
  createdAt?: string;
}

export interface Room {
  id: string;
  code: string; // Código corto de la sala, ej: "B405", "Trayectorias", "B-101"
  description?: string; // Qué es o dónde está, ej: "Amberes Sur B - 1"
  createdAt?: string;
}

// Usuario importado (p. ej. desde Excel) que todavía no tiene cuenta ni ha recibido correo
// No guarda el RUT: solo su contraseña inicial (últimos 4 del RUT) cifrada en el servidor
export interface PendingUser {
  id: string;
  name: string;
  email: string;
  career: string;
  role: 'alumno' | 'tutor' | 'docente' | null;
  tutorTypes: TutorType[];
  createdAt: string;
}
