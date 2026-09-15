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
