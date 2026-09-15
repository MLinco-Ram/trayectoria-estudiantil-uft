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
  role: Role;
  tutorType?: TutorType;
  assignedTutorIds?: string[]; // IDs de tutores pares supervisados por este Tutor de Tutores
  email: string;
  career?: string; // Optional career for student/tutor
  password?: string; // Optional password for registered users
}

export type ProgramType = 'tutorias' | 'psicoeducativo';

export type SessionType = 
  | 'tutoria_general' 
  | 'tutoria_personalizada' 
  | 'psico_taller' 
  | 'psico_asesoria_individual'
  | 'induccion'
  | 'clase_magistral'
  | 'taller_ampliado';

export interface SessionFeedback {
  studentId: string;
  studentName?: string;
  rating: number; // 1 to 5 stars
  comment: string;
  createdAt: string;
}

export interface Session {
  id: string;
  program: ProgramType;
  type: SessionType;
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
  status: 'pendiente' | 'resuelto';
  createdAt: string;
}

export interface WebNotification {
  id: string;
  toEmail: string;
  toName: string;
  subject: string;
  message: string;
  timestamp: string;
  read: boolean;
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
  status: 'pendiente' | 'resuelto';
  assignedSessionId?: string; // If resolved with a newly created session
  resolvedAt?: string;
  createdAt: string;
}

