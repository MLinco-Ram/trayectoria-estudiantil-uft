import { User, Session, IssueReport, WebNotification, UserAvailability, StudentRequest, SmtpSettings } from '../types';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data?.error || `Error ${res.status}: ${res.statusText}`;
    throw new Error(errorMsg);
  }
  return data as T;
}

// --- AUTENTICACIÓN ---
export const authApi = {
  login: async (credentials: { rut: string; password?: string }) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return handleResponse<User>(res);
  },

  forgotPassword: async (payload: { identifier: string; origin?: string }) => {
    const res = await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  verifyResetToken: async (token: string) => {
    const res = await fetch(`/api/verify-reset-token?token=${encodeURIComponent(token)}`);
    return handleResponse<{ valid: boolean; error?: string }>(res);
  },

  resetPassword: async (payload: { token: string; newPassword: string }) => {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },
};

// --- USUARIOS ---
export const usersApi = {
  getUsers: async () => {
    const res = await fetch('/api/users');
    return handleResponse<User[]>(res);
  },

  createUser: async (user: Partial<User>) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    return handleResponse<User>(res);
  },

  updateUser: async (id: string, data: Partial<User>) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean; user: User }>(res);
  },

  deleteUser: async (id: string) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },
};

// --- SESIONES ---
export const sessionsApi = {
  getSessions: async () => {
    const res = await fetch('/api/sessions');
    return handleResponse<Session[]>(res);
  },

  createSession: async (session: Session) => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    return handleResponse<Session>(res);
  },

  updateSession: async (id: string, data: Partial<Session>) => {
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean; updated: Partial<Session> }>(res);
  },

  deleteSession: async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  registerQRAttendance: async (sessionId: string, studentId: string) => {
    const res = await fetch(`/api/sessions/${sessionId}/qr-attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId }),
    });
    return handleResponse<{ success: boolean; session: Session; message: string }>(res);
  },
};

// --- DISPONIBILIDADES ---
export const availabilitiesApi = {
  getAvailabilities: async () => {
    const res = await fetch('/api/availabilities');
    return handleResponse<UserAvailability[]>(res);
  },

  saveAvailability: async (availability: UserAvailability) => {
    const res = await fetch('/api/availabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(availability),
    });
    return handleResponse<{ success: boolean; availability: UserAvailability }>(res);
  },
};

// --- REPORTES / INCIDENCIAS ---
export const reportsApi = {
  getReports: async () => {
    const res = await fetch('/api/reports');
    return handleResponse<IssueReport[]>(res);
  },

  createReport: async (report: IssueReport) => {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    return handleResponse<IssueReport>(res);
  },
};

// --- SOLICITUDES DE ESTUDIANTES (TOPES DE HORARIO) ---
export const studentRequestsApi = {
  getStudentRequests: async () => {
    const res = await fetch('/api/student-requests');
    return handleResponse<StudentRequest[]>(res);
  },

  createStudentRequest: async (request: StudentRequest) => {
    const res = await fetch('/api/student-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleResponse<StudentRequest>(res);
  },

  updateStudentRequest: async (id: string, data: Partial<StudentRequest>) => {
    const res = await fetch(`/api/student-requests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<{ success: boolean; updated: Partial<StudentRequest> }>(res);
  },
};

// --- NOTIFICACIONES ---
export const notificationsApi = {
  getNotifications: async (email?: string) => {
    const url = email ? `/api/notifications?email=${encodeURIComponent(email)}` : '/api/notifications';
    const res = await fetch(url);
    return handleResponse<WebNotification[]>(res);
  },

  createNotification: async (notification: Partial<WebNotification>) => {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    });
    return handleResponse<WebNotification>(res);
  },

  markAsRead: async (id: string) => {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: 'PUT',
    });
    return handleResponse<{ success: boolean }>(res);
  },

  markAllAsRead: async (email?: string) => {
    const res = await fetch('/api/notifications/read-all', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handleResponse<{ success: boolean }>(res);
  },
};

// --- AJUSTES SMTP ---
export const settingsApi = {
  getSmtpSettings: async () => {
    const res = await fetch('/api/settings/smtp');
    return handleResponse<Partial<SmtpSettings> & { hasPassword?: boolean; configured?: boolean }>(res);
  },

  saveSmtpSettings: async (settings: Partial<SmtpSettings>) => {
    const res = await fetch('/api/settings/smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },

  testSmtp: async (testEmail: string) => {
    const res = await fetch('/api/settings/smtp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testEmail }),
    });
    return handleResponse<{ success: boolean; message: string; messageId?: string }>(res);
  },
};

// --- COMUNICADOS / BROADCAST ---
export const broadcastApi = {
  broadcastMessage: async (payload: {
    docenteName: string;
    scope: 'all_community' | 'all_students' | 'all_tutors' | 'specific_session';
    sessionId?: string;
    subject: string;
    message: string;
    priority?: 'normal' | 'alta' | 'urgente';
  }) => {
    const res = await fetch('/api/broadcast-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{
      success: boolean;
      sentCount: number;
      recipients: Array<{ name: string; email: string; role: string }>;
      message: string;
    }>(res);
  },
};

// --- CORREO GENERAL ---
export const emailApi = {
  sendEmail: async (payload: {
    to: string;
    toName?: string;
    subject: string;
    text?: string;
    html?: string;
    fromName?: string;
  }) => {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; messageId?: string; simulated?: boolean }>(res);
  },
};

// --- MANTENIMIENTO DEL SISTEMA Y RESET ACADÉMICO ---
export const systemApi = {
  resetAcademicData: async (targetCollections?: string[]) => {
    const res = await fetch('/api/system/reset-academic-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCollections }),
    });
    return handleResponse<{
      success: boolean;
      message: string;
      deletedCounts: Record<string, number | string>;
      preservedCollections: string[];
      timestamp: string;
    }>(res);
  },
};

