import React, { useState, useEffect } from 'react';
import { User, Session, WebNotification, UserAvailability, StudentRequest } from '../types';
import { 
  getSavedSessions, 
  saveSessions, 
  getSavedNotifications, 
  saveNotifications, 
  triggerNotification, 
  getSavedUsers,
  saveUsers,
  TIME_SLOTS,
  getSavedAvailabilities,
  saveAvailabilities,
  getSavedStudentRequests,
  saveStudentRequests,
  getTodayDateStr,
  getDynamicPresetDates
} from '../data';
import { getSocket } from '../services/socket';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  LogOut, 
  CheckCircle2, 
  Bell, 
  BookOpen, 
  Award, 
  Grid, 
  History, 
  Inbox,
  UserCheck,
  AlertCircle,
  FileText,
  Send,
  Check,
  Plus,
  X,
  Mail,
  CheckCheck,
  Star,
  MessageSquare,
  ThumbsUp,
  Sparkles,
  GraduationCap,
  Home,
  QrCode,
  User as UserIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MobileQRScannerModal } from './common/MobileQRScannerModal';
import { ThemeToggle } from './common/ThemeToggle';

interface AlumnoDashboardProps {
  user?: User;
  onLogout?: () => void;
  onUpdateUser?: (user: User) => void;
}

export default function AlumnoDashboard({ user: propUser, onLogout: propLogout, onUpdateUser: propUpdateUser }: AlumnoDashboardProps = {}) {
  const auth = useAuth();
  const user = propUser || auth.currentUser;
  const onLogout = propLogout || auth.logout;
  const onUpdateUser = propUpdateUser || auth.updateUser;

  if (!user) return null;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [notifications, setNotifications] = useState<WebNotification[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>(getSavedUsers());
  
  // Tab view controller with persistence across reloads
  // tutorias, psicoeducativo, my_bookings, history, disponibilidad, inconvenientes
  const [activeSegment, setActiveSegment] = useState<'tutorias' | 'psicoeducativo' | 'my_bookings' | 'history' | 'disponibilidad' | 'inconvenientes'>(() => {
    const saved = localStorage.getItem('uft_alumno_active_segment');
    return (saved as 'tutorias' | 'psicoeducativo' | 'my_bookings' | 'history' | 'disponibilidad' | 'inconvenientes') || 'tutorias';
  });

  useEffect(() => {
    if (activeSegment) {
      localStorage.setItem('uft_alumno_active_segment', activeSegment);
    }
  }, [activeSegment]);
  
  // Date selector for schedules
  const [targetDate, setTargetDate] = useState<string>(getTodayDateStr());
  
  // Notification center toggle & timeframe filter
  const [showNotifInbox, setShowNotifInbox] = useState(false);
  const [notifTimeframe, setNotifTimeframe] = useState<'week' | 'all'>('week');
  const [bookingFeedback, setBookingFeedback] = useState<string | null>(null);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false);

  // Availability & Requests States
  const [myAvailability, setMyAvailability] = useState<UserAvailability>({
    userId: user.id,
    role: 'alumno',
    days: [
      { day: 'Lunes', slots: [] },
      { day: 'Martes', slots: [] },
      { day: 'Miércoles', slots: [] },
      { day: 'Jueves', slots: [] },
      { day: 'Viernes', slots: [] },
      { day: 'Sábado', slots: [] },
      { day: 'Domingo', slots: [] }
    ],
    updatedAt: new Date().toISOString()
  });

  const [myRequests, setMyRequests] = useState<StudentRequest[]>([]);
  
  // Form hooks
  const [reqMessage, setReqMessage] = useState('');
  const [reqPreferredTime, setReqPreferredTime] = useState('');
  const [reqProgram, setReqProgram] = useState<'tutorias' | 'psicoeducativo'>('tutorias');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // Feedback & Satisfaction state (Calificación de 1 a 5 estrellas y comentarios)
  const [evaluatingSession, setEvaluatingSession] = useState<Session | null>(null);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [ratingHover, setRatingHover] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [ratingSuccessMsg, setRatingSuccessMsg] = useState<string | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  // Expandable syllabus state for history classes
  const [expandedHistorySyllabusIds, setExpandedHistorySyllabusIds] = useState<Record<string, boolean>>({});

  const toggleHistorySyllabus = (sessionId: string) => {
    setExpandedHistorySyllabusIds(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  // Submit Satisfaction Evaluation
  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingSession) return;

    setIsSubmittingRating(true);
    const feedbackObj = {
      studentId: user.id,
      studentName: user.name,
      rating: ratingStars,
      comment: ratingComment.trim(),
      createdAt: new Date().toISOString()
    };

    const current = getSavedSessions();
    let updatedTargetSession: Session | null = null;
    const updated = current.map(s => {
      if (s.id === evaluatingSession.id) {
        updatedTargetSession = {
          ...s,
          ratings: {
            ...(s.ratings || {}),
            [user.id]: feedbackObj
          }
        };
        return updatedTargetSession;
      }
      return s;
    });

    saveSessions(updated);
    setSessions(updated);

    // Sync to backend/MongoDB
    if (updatedTargetSession) {
      try {
        await fetch(`/api/sessions/${evaluatingSession.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTargetSession)
        });
      } catch (err) {
        console.warn('Sync rating error:', err);
      }
    }

    setIsSubmittingRating(false);
    setRatingSuccessMsg('¡Muchas gracias! Tu evaluación y comentarios han sido registrados con éxito.');
    setTimeout(() => {
      setEvaluatingSession(null);
      setRatingSuccessMsg(null);
      setRatingComment('');
      setRatingStars(5);
    }, 2000);
  };

  // Availability setup days
  const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  useEffect(() => {
    reloadData();

    const handleStorage = () => {
      reloadData();
    };
    window.addEventListener('storage', handleStorage);

    // Sincronización en tiempo real vía WebSockets
    const socket = getSocket();
    const handleRealtimeUpdate = () => {
      reloadData();
    };

    socket.on('sessions:changed', handleRealtimeUpdate);
    socket.on('student_requests:changed', handleRealtimeUpdate);
    socket.on('notifications:changed', handleRealtimeUpdate);
    socket.on('users:changed', handleRealtimeUpdate);
    socket.on('availabilities:changed', handleRealtimeUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      socket.off('sessions:changed', handleRealtimeUpdate);
      socket.off('student_requests:changed', handleRealtimeUpdate);
      socket.off('notifications:changed', handleRealtimeUpdate);
      socket.off('users:changed', handleRealtimeUpdate);
      socket.off('availabilities:changed', handleRealtimeUpdate);
    };
  }, [user.email, user.id, user.name, user.career]);

  const reloadData = async () => {
    setSessions(getSavedSessions());
    
    // Cargar notificaciones locales
    const localNotifs = getSavedNotifications().filter(n => n.toEmail && n.toEmail.toLowerCase() === (user.email || '').toLowerCase());
    setNotifications(localNotifs);

    // Sincronizar notificaciones y comunicados en tiempo real desde MongoDB Atlas
    try {
      if (user.email) {
        const notifRes = await fetch(`/api/notifications?email=${encodeURIComponent(user.email)}`);
        if (notifRes.ok) {
          const notifsFromApi = await notifRes.json();
          if (Array.isArray(notifsFromApi)) {
            // Unir y ordenar por fecha descendente
            const map = new Map();
            localNotifs.forEach(n => map.set(n.id, n));
            notifsFromApi.forEach((n: WebNotification) => map.set(n.id, n));
            const merged = Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setNotifications(merged);
            saveNotifications(merged);
          }
        }
      }
    } catch (nErr) {
      // fallback a notificaciones locales
    }
    
    // Cargar usuarios actualizados desde MongoDB Atlas y cache
    let currentUsers = getSavedUsers();
    try {
      const uRes = await fetch('/api/users');
      if (uRes.ok) {
        const usersFromApi = await uRes.json();
        if (Array.isArray(usersFromApi) && usersFromApi.length > 0) {
          currentUsers = usersFromApi;
          saveUsers(usersFromApi);
        }
      }
    } catch (e) {
      // fallback
    }
    setAllUsers(currentUsers);

    const availList = getSavedAvailabilities();
    const existing = availList.find(a => a.userId === user.id);
    if (existing) setMyAvailability(existing);

    const allReqs = getSavedStudentRequests();
    setMyRequests(allReqs.filter(r => r.studentId === user.id));

    // Sincronizar solicitudes y sesiones en tiempo real desde MongoDB
    try {
      const rRes = await fetch('/api/student-requests');
      if (rRes.ok) {
        const reqsFromApi = await rRes.json();
        if (Array.isArray(reqsFromApi) && reqsFromApi.length > 0) {
          saveStudentRequests(reqsFromApi);
          setMyRequests(reqsFromApi.filter((r: StudentRequest) => r.studentId === user.id));
        }
      }
    } catch (e) {
      // ignore
    }

    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const sessionsFromApi = await res.json();
        if (Array.isArray(sessionsFromApi) && sessionsFromApi.length > 0) {
          setSessions(sessionsFromApi);
          saveSessions(sessionsFromApi);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  // Filter sessions that are open for registration on selected day
  const availableSchedules = sessions.filter(s => {
    const isProgramMatch = s.program === activeSegment;
    const isDateMatch = s.date === targetDate;
    // Public sessions: general, taller, induccion, clase magistral, taller ampliado, or direct student assignment
    const isPublic = s.type === 'tutoria_general' || 
                     s.type === 'psico_taller' || 
                     s.type === 'induccion' || 
                     s.type === 'clase_magistral' || 
                     s.type === 'taller_ampliado';
    const isPublicOrMine = isPublic || s.studentIds.includes(user.id);
    return isProgramMatch && isDateMatch && isPublicOrMine;
  });

  // Active bookings where student is registered and session is not completed/closed
  const myActiveBookings = sessions.filter(s => s.studentIds.includes(user.id) && !s.isCompleted && s.attendance?.[user.id] !== 'presente' && s.attendance?.[user.id] !== 'ausente');
  
  // History of completed classes or marked attendance (presente or ausente)
  const myHistory = sessions.filter(s => s.studentIds.includes(user.id) && (s.isCompleted || s.attendance?.[user.id] === 'presente' || s.attendance?.[user.id] === 'ausente'));

  // Helper to check if session is at least 2 hours in the future
  const isRegistrationWindowClosed = (sessionDate: string, timeSlot: string): boolean => {
    try {
      const startTimeStr = timeSlot.split('-')[0].trim(); // e.g. "10:30"
      const [hours, minutes] = startTimeStr.split(':').map(Number);
      const sessionDateTime = new Date(`${sessionDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
      
      const now = new Date();
      const diffMs = sessionDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Si falta menos de 2 horas (o ya pasó), el plazo de inscripción está cerrado
      return diffHours < 2;
    } catch (e) {
      return false;
    }
  };

  // Enroll student in an group session / workshop
  const handleRegisterSlot = (session: Session) => {
    // Check if already registered
    if (session.studentIds.includes(user.id)) {
      setBookingFeedback('Ya te encuentras registrado en este bloque horario.');
      return;
    }

    // Check 2-hour deadline limit before session start
    if (isRegistrationWindowClosed(session.date, session.timeSlot)) {
      setBookingFeedback('⚠️ Plazo de inscripción cerrado: Las inscripciones deben realizarse con al menos 2 horas de anticipación antes del inicio de la tutoría.');
      return;
    }

    // Check if full
    if (session.studentIds.length >= session.maxSpots) {
      setBookingFeedback('Este bloque de horario ya se encuentra lleno. Solicita una tutoría personalizada con el docente.');
      return;
    }

    const current = getSavedSessions();
    let updatedTargetSession: Session | null = null;
    const updated = current.map(s => {
      if (s.id === session.id) {
        updatedTargetSession = {
          ...s,
          studentIds: [...s.studentIds, user.id],
          attendance: {
            ...(s.attendance || {}),
            [user.id]: 'pendiente' as const
          }
        };
        return updatedTargetSession;
      }
      return s;
    });

    saveSessions(updated);
    setSessions(updated);

    // Sincronizar en MongoDB Atlas en paralelo
    if (updatedTargetSession) {
      fetch(`/api/sessions/${session.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTargetSession)
      }).catch(err => console.warn('Sync Mongo en background:', err));
    }

    // Notify student via email notification con datos reales de MongoDB
    const tutorObj = session.tutorId ? allUsers.find(t => t.id === session.tutorId) : null;
    const docenteObj = allUsers.find(d => d.id === session.docenteId);
    const tipoPrograma = session.program === 'tutorias' ? 'Programa de Tutorías Académicas UFT' : 'Programa Psicoeducativo y Apoyo Estudiantil';
    const tutorInfo = tutorObj ? `\n• Tutor(a) Asignado(a): ${tutorObj.name} (${tutorObj.email})` : '';
    const docenteInfo = docenteObj ? `\n• Coordinador(a) / Docente: ${docenteObj.name}` : '';
    const materiaInfo = session.subject ? `\n• Asignatura / Área: ${session.subject}` : '';

    // 1. Correo de Confirmación de Inscripción con diseño institucional UFT
    const confirmationSubject = `Confirmación de Inscripción: ${session.title}`;
    const confirmationMessage = `Estimado/a ${user.name},

Te confirmamos exitosamente tu inscripción a la sesión académica con el siguiente detalle:

• Actividad: ${session.title}
• Programa: ${tipoPrograma}${materiaInfo}
• Fecha: ${session.date}
• Horario: ${session.timeSlot}
• Lugar / Modalidad: ${session.location}${tutorInfo}${docenteInfo}
• RUT Alumno: ${user.rut}
• Carrera: ${user.career || 'Pregrado UFT'}

Por favor guarda este comprobante. Ante cualquier inconveniente, puedes gestionar tu cupo desde el portal estudiantil.

Atentamente,
Dirección de Trayectoria Estudiantil - Universidad Finis Terrae`;

    const confirmationHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${confirmationSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #092c4c 0%, #153a5c 100%); padding: 32px 28px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <div style="display: inline-block; background-color: #3a9ad9; color: #ffffff; font-weight: 900; font-size: 18px; width: 42px; height: 42px; line-height: 42px; border-radius: 10px; text-align: center;">T</div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Trayectoria <span style="color: #3a9ad9;">UFT.</span></h1>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Universidad Finis Terrae</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Success Badge Section -->
          <tr>
            <td style="padding: 28px 28px 12px 28px; text-align: center;">
              <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 30px; padding: 6px 18px; margin-bottom: 12px;">
                <span style="color: #059669; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">✓ Reserva Confirmada</span>
              </div>
              <h2 style="margin: 0; color: #0f172a; font-size: 18px; font-weight: 800; line-height: 1.3;">${session.title}</h2>
              <p style="margin: 6px 0 0 0; color: #64748b; font-size: 13px;">Hola <strong>${user.name}</strong>, tu cupo ha sido reservado exitosamente.</p>
            </td>
          </tr>

          <!-- Session Details Box -->
          <tr>
            <td style="padding: 12px 28px 20px 28px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 18px;">
                
                <tr>
                  <td style="padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="30" valign="top" style="font-size: 16px;">📅</td>
                        <td>
                          <span style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; display: block;">Fecha de la Sesión</span>
                          <strong style="color: #092c4c; font-size: 14px;">${session.date}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="30" valign="top" style="font-size: 16px;">⏰</td>
                        <td>
                          <span style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; display: block;">Horario del Módulo</span>
                          <strong style="color: #092c4c; font-size: 14px;">${session.timeSlot}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="30" valign="top" style="font-size: 16px;">📍</td>
                        <td>
                          <span style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; display: block;">Ubicación / Sala</span>
                          <strong style="color: #092c4c; font-size: 14px;">${session.location}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 12px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="30" valign="top" style="font-size: 16px;">🎓</td>
                        <td>
                          <span style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; display: block;">Programa y Responsables</span>
                          <strong style="color: #092c4c; font-size: 13px;">${tipoPrograma}</strong>
                          ${session.subject ? `<div style="color: #475569; font-size: 12px; margin-top: 2px;">• Asignatura: <strong>${session.subject}</strong></div>` : ''}
                          ${tutorObj ? `<div style="color: #475569; font-size: 12px; margin-top: 2px;">• Tutor(a) Par: <strong>${tutorObj.name}</strong> (${tutorObj.email})</div>` : ''}
                          ${docenteObj ? `<div style="color: #475569; font-size: 12px; margin-top: 2px;">• Coordinación Docente: <strong>${docenteObj.name}</strong></div>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Student Profile Meta -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border-radius: 10px; padding: 12px 16px; font-size: 11px; color: #475569;">
                <tr>
                  <td><strong>RUT:</strong> ${user.rut}</td>
                  <td align="right"><strong>Carrera:</strong> ${user.career || 'Pregrado UFT'}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notice / Instructions -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <div style="background-color: #eff6ff; border-left: 4px solid #3a9ad9; border-radius: 0 8px 8px 0; padding: 12px 14px;">
                <h4 style="margin: 0 0 4px 0; color: #1e3a8a; font-size: 12px; font-weight: 800;">💡 Recomendaciones Importantes:</h4>
                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #1e40af; line-height: 1.5;">
                  <li>Llega 5 minutos antes al módulo asignado.</li>
                  <li>Recuerda registrar tu asistencia al iniciar la actividad.</li>
                  <li>Si no puedes asistir, cancela tu reserva desde el portal con anticipación.</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 600;">
                © 2026 Dirección de Trayectoria Estudiantil • Universidad Finis Terrae
              </p>
              <p style="margin: 4px 0 0 0; color: #cbd5e1; font-size: 10px;">
                Este es un mensaje institucional generado automáticamente por el Portal de Trayectoria Estudiantil.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    triggerNotification(
      user.email,
      user.name,
      confirmationSubject,
      confirmationMessage,
      confirmationHtml
    );

    // 2. Correo de Aviso / Recordatorio de Asistencia Obligatoria y Puntualidad
    const reminderSubject = `Recordatorio de Asistencia: ${session.title} (${session.date} - ${session.timeSlot})`;
    const reminderMessage = `Hola ${user.name},

Te recordamos que tienes una sesión agendada para el día ${session.date} a las ${session.timeSlot} en ${session.location}.

Recuerda:
1. Asistir puntualmente a la sala/box asignado (${session.location}).
2. Registrar tu asistencia con el docente o tutor a cargo al inicio del bloque.
3. Si no puedes asistir, cancela tu reserva con anticipación en el portal para liberar el cupo a otro compañero.

¡Mucho éxito en tu sesión!
Equipo de Acompañamiento Académico UFT`;

    const reminderHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${reminderSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
          
          <tr>
            <td style="background: #092c4c; padding: 24px; text-align: center;">
              <h2 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 800;">🔔 Recordatorio de Acompañamiento Académico</h2>
              <p style="margin: 4px 0 0 0; color: #3a9ad9; font-size: 12px; font-weight: 700;">Universidad Finis Terrae</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 28px;">
              <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px; font-weight: 800;">Hola ${user.name},</h3>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 13px; line-height: 1.5;">
                Te recordamos que tienes una actividad académica agendada para:
              </p>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <div style="font-size: 14px; font-weight: 800; color: #092c4c; margin-bottom: 8px;">${session.title}</div>
                <div style="font-size: 12px; color: #334155; margin-bottom: 4px;">📅 <strong>Fecha:</strong> ${session.date}</div>
                <div style="font-size: 12px; color: #334155; margin-bottom: 4px;">⏰ <strong>Horario:</strong> ${session.timeSlot}</div>
                <div style="font-size: 12px; color: #334155;">📍 <strong>Lugar:</strong> ${session.location}</div>
              </div>

              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
                Tu asistencia y puntualidad son fundamentales para aprovechar esta instancia de reforzamiento.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
              Dirección de Trayectoria Estudiantil • Universidad Finis Terrae
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    triggerNotification(
      user.email,
      user.name,
      reminderSubject,
      reminderMessage,
      reminderHtml
    );

    setBookingFeedback(`¡Inscripción confirmada! Te hemos enviado el comprobante detallado y el aviso recordatorio de asistencia a tu correo institucional: ${user.email}`);
    reloadData();

    // Clear feedback
    setTimeout(() => {
      setBookingFeedback(null);
    }, 5000);
  };

  // Withdraw / Cancel booking
  const handleCancelBooking = async (sessionId: string) => {
    if (confirm('¿Estás seguro que deseas cancelar tu reserva para esta tutoría/taller?')) {
      const current = getSavedSessions();
      let updatedSessionObj: Session | null = null;
      const updated = current.map(s => {
        if (s.id === sessionId) {
          const newStudentIds = s.studentIds.filter(id => id !== user.id);
          const att = { ...(s.attendance || {}) };
          delete att[user.id];
          
          updatedSessionObj = {
            ...s,
            studentIds: newStudentIds,
            attendance: att
          };
          return updatedSessionObj;
        }
        return s;
      });

      saveSessions(updated);
      setSessions(updated);

      // Sincronizar actualización en MongoDB Atlas de inmediato
      if (updatedSessionObj) {
        try {
          await fetch(`/api/sessions/${sessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedSessionObj)
          });
        } catch (err) {
          console.warn('Sync cancel booking in Mongo:', err);
        }
      }

      // Notify cancel confirmation
      const targetSession = sessions.find(sm => sm.id === sessionId);
      if (targetSession) {
        triggerNotification(
          user.email,
          user.name,
          `Cancelación de Reserva: ${targetSession.title}`,
          `Hola ${user.name}, has liberado tu cupo en la sesión "${targetSession.title}" del día ${targetSession.date} a las ${targetSession.timeSlot}.`
        );
      }

      reloadData();
    }
  };

  // Mark in-app emails as read
  const handleMarkAllRead = () => {
    const allNotifs = getSavedNotifications();
    const updatedNotifs = allNotifs.map(n => {
      if (n.toEmail === user.email) {
        return { ...n, read: true };
      }
      return n;
    });
    saveNotifications(updatedNotifs);
    reloadData();
  };

  const presetDates = getDynamicPresetDates(5);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-[#f8fafc] flex flex-col md:flex-row font-sans" id="alumno-dashboard-wrapper">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex w-72 bg-black text-white flex-col shrink-0 justify-between relative overflow-hidden rounded-r-[2.5rem] sticky top-0 h-screen z-10 select-none">
        <div className="flex flex-col flex-1 overflow-y-auto relative z-10">
          {/* Tarjeta de Perfil del Alumno */}
          <div className="p-5 mx-4 mt-5 mb-4 bg-white rounded-2xl shadow-md space-y-2.5 relative shrink-0">
            <div
              className="flex items-center gap-1.5 text-brand-celeste font-bold text-sm cursor-pointer w-fit"
              onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
              title="Click para ver opciones de sesión"
            >
              <UserIcon className="h-4 w-4" />
              <span>Perfil alumno</span>
            </div>
            <div className="font-extrabold text-brand-navy text-sm leading-snug">{user.name}</div>
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <GraduationCap className="h-3.5 w-3.5 text-brand-celeste shrink-0" />
              <span className="truncate">{user.career || 'Estudiante UFT'}</span>
            </div>

            {showLogoutDropdown && (
              <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 space-y-2 animate-fade-in text-xs absolute left-0 right-0 z-50 shadow-lg top-[100%] mt-1">
                <div className="pb-1.5 border-b border-white/10 text-[11px] text-slate-300">
                  <p className="font-bold text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-brand-celeste truncate">{user.email}</p>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">RUT: {user.rut}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutDropdown(false);
                    onLogout();
                  }}
                  className="w-full bg-red-650 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>

          <nav className="flex-1 px-4 space-y-2 pb-4">
            <button
              onClick={() => { setActiveSegment('tutorias'); }}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeSegment === 'tutorias' ? 'bg-brand-celeste text-white shadow-md' : 'bg-white text-brand-navy hover:bg-slate-100'}`}
            >
              <Award className="h-4 w-4 shrink-0" />
              <span>Tutorías Colectivas</span>
            </button>

            <button
              onClick={() => { setActiveSegment('psicoeducativo'); }}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeSegment === 'psicoeducativo' ? 'bg-brand-celeste text-white shadow-md' : 'bg-white text-brand-navy hover:bg-slate-100'}`}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>Talleres Psicoeducativos</span>
            </button>

            <button
              onClick={() => { setActiveSegment('my_bookings'); }}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeSegment === 'my_bookings' ? 'bg-brand-celeste text-white shadow-md' : 'bg-white text-brand-navy hover:bg-slate-100'}`}
            >
              <Grid className="h-4 w-4 shrink-0" />
              <span>Mis Reservas Activas</span>
            </button>

            <button
              onClick={() => { setActiveSegment('history'); }}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeSegment === 'history' ? 'bg-brand-celeste text-white shadow-md' : 'bg-white text-brand-navy hover:bg-slate-100'}`}
            >
              <History className="h-4 w-4 shrink-0" />
              <span>Historial de Clases</span>
            </button>

            <div className="pt-2">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider px-2.5 mb-1.5 block">
                Herramientas Flexibles
              </p>

              <button
                onClick={() => { setActiveSegment('disponibilidad'); }}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer mb-2 ${activeSegment === 'disponibilidad' ? 'bg-brand-celeste text-white shadow-md' : 'bg-white text-brand-navy hover:bg-slate-100'}`}
              >
                <Clock className="h-4 w-4 shrink-0" />
                <span>Declarar Mi Horario</span>
              </button>

              <button
                onClick={() => { setActiveSegment('inconvenientes'); }}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${activeSegment === 'inconvenientes' ? 'bg-brand-celeste text-white shadow-md' : 'bg-white text-brand-navy hover:bg-slate-100'}`}
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Informar Inconveniente</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 relative z-10 space-y-2">
          <button
            type="button"
            onClick={() => setShowNotifInbox(prev => !prev)}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              showNotifInbox 
                ? 'bg-brand-celeste text-white shadow-md' 
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <span className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-[#3a9ad9]" />
              <span>Bandeja de Correo</span>
            </span>
            {unreadCount > 0 && (
              <span className="bg-[#e28743] text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-600 transition-all cursor-pointer border border-rose-500/30 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>

          <div className="flex justify-center items-center pt-1">
            <div className="bg-white px-4 py-2 rounded-2xl shadow-md flex items-center justify-center w-full">
              <img
                src="/logo-uft-oficial.png"
                alt="Universidad Finis Terrae"
                className="h-7 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Column */}
      <main className="flex-1 flex flex-col md:h-screen md:overflow-y-auto min-w-0 relative z-10" id="student-main-panel-workspace">
        
        {/* Mobile Header Bar */}
        <header className="md:hidden bg-[#092c4c] text-white px-4 py-3 flex flex-col space-y-2 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-white p-1 rounded-lg flex items-center justify-center">
                <img src="/logo-uft.png" alt="UFT" className="h-6 w-auto object-contain" />
              </div>
              <h1 className="text-sm font-bold tracking-tight">
                Trayectoria <span className="text-[#3a9ad9]">UFT</span>
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setShowNotifInbox(!showNotifInbox)}
                className="relative p-1.5 rounded-full hover:bg-white/10 text-[#3a9ad9]"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white rounded-full w-3.5 h-3.5 text-[8px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={onLogout}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded"
              >
                Salir
              </button>
            </div>
          </div>
          {/* Mobile horizontal tabs bar */}
          <div className="flex overflow-x-auto py-1 gap-1.5 scrollbar-none">
            <button
              onClick={() => { setActiveSegment('tutorias'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${activeSegment === 'tutorias' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-white/10 text-white'}`}
            >
              Tutorías
            </button>
            <button
              onClick={() => { setActiveSegment('psicoeducativo'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${activeSegment === 'psicoeducativo' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-white/10 text-white'}`}
            >
              Talleres
            </button>
            <button
              onClick={() => { setActiveSegment('my_bookings'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${activeSegment === 'my_bookings' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-white/10 text-white'}`}
            >
              Mis Reservas
            </button>
            <button
              onClick={() => { setActiveSegment('history'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${activeSegment === 'history' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-[#153a5c] text-white'}`}
            >
              Historial
            </button>
            <button
              onClick={() => { setActiveSegment('disponibilidad'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${activeSegment === 'disponibilidad' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-[#153a5c] text-white'}`}
            >
              Horarios
            </button>
            <button
              onClick={() => { setActiveSegment('inconvenientes'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${activeSegment === 'inconvenientes' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-[#153a5c] text-white'}`}
            >
              Avisos
            </button>
          </div>
        </header>

        {/* Desktop Top Header Bar with navigation trial breadcrumb & action triggers */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-8 shrink-0 shadow-sm">
          <div className="flex items-center gap-3 text-slate-400">
            <span className="text-sm font-semibold text-slate-600">Portal Estudiantil</span>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-500 font-medium font-sans">
              {activeSegment === 'tutorias' && 'Tutoría General de Apoyo Colectivo'}
              {activeSegment === 'psicoeducativo' && 'Talleres Psicoeducativos de Autogestión'}
              {activeSegment === 'my_bookings' && 'Tus Bloques de Talleres Inscritos'}
              {activeSegment === 'history' && 'Certificaciones e Historial Académico'}
              {activeSegment === 'disponibilidad' && 'Tu Disponibilidad de Horario Declarada'}
              {activeSegment === 'inconvenientes' && 'Bandeja de Inconvenientes de Clase y Horario Flexible'}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400 font-semibold uppercase font-mono">RUT: {user.rut}</span>
            <ThemeToggle />
          </div>
        </header>

        {/* Content Section Wrapper */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 pb-28 md:pb-8 max-w-4xl w-full mx-auto" id="alumno-main-dynamic-card-viewport">
        
        {/* Profile Info matching "MAYRA CAROLINA LINCO LEIVA" card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4 relative overflow-hidden" id="student-main-profile-card">
          <div className="absolute top-0 right-0 bg-brand-celeste/20 text-brand-navy rounded-bl-xl px-3 py-1 text-[9px] font-bold uppercase tracking-wider">
            PREGRADO UFT
          </div>

          <div className="space-y-1 relative">
            <h2 className="text-base font-extrabold uppercase text-slate-800 tracking-tight leading-tight">
              {user.name}
            </h2>
            <p className="text-xs text-brand-celeste font-bold">{user.career}</p>
            <p className="text-[10px] text-slate-400 font-mono">RUT: {user.rut}</p>
          </div>

          {/* Booking Metrics */}
          <div className="grid grid-cols-2 gap-4 pt-3.5 border-t border-slate-100">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Reservas Activas</span>
              <span className="text-lg font-bold text-brand-navy block mt-0.5">{myActiveBookings.length} / 3</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Asistencias</span>
              <span className="text-lg font-bold text-brand-navy block mt-0.5">{myHistory.length}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Booking Screen Section */}
        <div className="mt-5 space-y-4" id="alumno-segment-body">
          
          {bookingFeedback && (
            <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold animate-fade-in flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{bookingFeedback}</span>
            </div>
          )}

          {/* Date Picker (Calendar selector widget shown above slot cards in reference gym mockup) */}
          {(activeSegment === 'tutorias' || activeSegment === 'psicoeducativo') && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-100 p-4 space-y-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Selecciona una Fecha
              </label>
              
              <div className="flex gap-2">
                {presetDates.map(d => {
                  const dateObj = new Date(d + "T00:00:00");
                  const weekday = dateObj.toLocaleDateString('es-ES', { weekday: 'short' });
                  const day = dateObj.getDate();
                  const isCur = d === targetDate;

                  return (
                    <button
                      key={d}
                      onClick={() => setTargetDate(d)}
                      className={`flex-1 py-1.5 rounded-lg border text-center transition-all cursor-pointer ${isCur ? 'bg-brand-celeste border-brand-celeste text-white font-bold' : 'bg-slate-50 border-slate-100 text-slate-700 font-semibold'}`}
                    >
                      <span className="block text-[8px] uppercase">{weekday}</span>
                      <span className="block text-sm">{day}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* A. BOOK SCHEDULER VIEW (Tutorias General and Psycoeducational sessions) */}
          {(activeSegment === 'tutorias' || activeSegment === 'psicoeducativo') && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider pl-1.5 mt-2">
                Módulos de Horario Disponibles
              </h3>

              {availableSchedules.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl border border-slate-100 text-center space-y-2">
                  <Calendar className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="text-xs text-slate-500 font-bold">No hay cupos disponibles el {targetDate}</p>
                  <p className="text-[11px] text-slate-400">
                    Pregunta a tu coordinador si hay tutorías personalizadas o de apoyo extraordinario para habilitar.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3" id="academic-visual-slots-grid">
                  {availableSchedules.map(session => {
                    const enrolledCount = session.studentIds.length;
                    const isRegistered = session.studentIds.includes(user.id);
                    const isFull = enrolledCount >= session.maxSpots;

                    const isClosedDeadline = isRegistrationWindowClosed(session.date, session.timeSlot);

                    return (
                      <div 
                        key={session.id} 
                        className={`bg-white rounded-xl border p-4 text-center transition-all flex flex-col justify-between space-y-2.5 ${isRegistered ? 'border-brand-celeste ring-1 ring-brand-celeste/40 bg-blue-50/10' : 'border-slate-100 hover:border-brand-celeste'}`}
                      >
                        <div>
                          <span className="text-xs font-extrabold text-slate-800 block">
                            {session.timeSlot}
                          </span>
                          <span className="text-[9px] text-slate-400 block truncate font-medium mt-0.5">
                            {session.title}
                          </span>
                          <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                            <span className="inline-block text-[9px] text-indigo-800 bg-indigo-50 font-semibold rounded px-2">
                              {enrolledCount}/{session.maxSpots} cupos
                            </span>
                            {isClosedDeadline && !isRegistered && (
                              <span className="inline-block text-[8px] text-amber-700 bg-amber-50 font-bold rounded px-1.5 border border-amber-200">
                                ⏱️ Cierre &lt;2h
                              </span>
                            )}
                          </div>
                          {session.syllabus && (
                            <div className="mt-2 bg-indigo-50/70 p-1.5 rounded text-[9.5px] text-indigo-900 border border-indigo-100 text-left line-clamp-2" title={session.syllabus}>
                              <span className="font-bold">📋 Temario:</span> {session.syllabus}
                            </div>
                          )}
                        </div>

                        {isRegistered ? (
                          <div className="bg-emerald-50 text-emerald-800 rounded-lg text-[9px] font-bold py-1.5 flex items-center justify-center space-x-1 border border-emerald-100">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Reservado</span>
                          </div>
                        ) : isFull ? (
                          <div className="bg-red-50 text-red-600 rounded-lg text-[9px] font-bold py-1.5 border border-red-100 select-none">
                            Lleno
                          </div>
                        ) : isClosedDeadline ? (
                          <div 
                            className="bg-slate-100 text-slate-400 rounded-lg text-[9px] font-bold py-1.5 border border-slate-200 select-none cursor-not-allowed"
                            title="El plazo de inscripción cerró porque faltan menos de 2 horas para el inicio de la sesión."
                          >
                            Plazo Cerrado (&lt;2h)
                          </div>
                        ) : (
                          <button
                            onClick={() => handleRegisterSlot(session)}
                            className="w-full bg-brand-navy hover:bg-slate-900 text-white font-bold text-[10px] py-2 rounded-lg cursor-pointer transition-colors uppercase tracking-wide"
                          >
                            Inscribirse
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* B. MY RESERVED ACTIVE SESSIONS VIEW */}
          {activeSegment === 'my_bookings' && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider pl-1.5">
                Mis Tutorías y Talleres Reservados
              </h3>

              {myActiveBookings.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl border border-slate-100 text-center space-y-2">
                  <Clock className="mx-auto h-8 w-8 text-slate-300" />
                  <h4 className="text-xs font-bold text-slate-600">No tienes reservas activas</h4>
                  <p className="text-[11px] text-slate-400">Usa el menú arriba para elegir el programa de interés e inscribirte.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {myActiveBookings.map(s => {
                    const tutorObj = s.tutorId ? allUsers.find(t => t.id === s.tutorId) : null;
                    return (
                      <div key={s.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-xs space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                              {s.program === 'tutorias' ? 'Programa Tutorías' : 'Módulo Psicoeducativo'}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 leading-snug mt-0.5">{s.title}</h4>
                          </div>

                          <span className="bg-blue-50 text-brand-navy rounded font-mono font-bold text-[10px] px-2 py-0.5 whitespace-nowrap">
                            {s.date}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-50">
                          <p className="flex items-center space-x-1.5">
                            <Clock className="h-3 w-3 text-slate-400 inline mr-1" />
                            <span>Horario: {s.timeSlot}</span>
                          </p>
                          <p className="flex items-center space-x-1.5">
                            <MapPin className="h-3 w-3 text-slate-400 inline mr-1" />
                            <span>Ubicación: {s.location}</span>
                          </p>
                          {tutorObj && (
                            <div className="bg-indigo-50/70 p-2 rounded-lg border border-indigo-100/80 space-y-0.5">
                              <p className="flex items-center space-x-1.5 text-indigo-900 font-bold">
                                <UserCheck className="h-3 w-3 text-indigo-600 inline mr-1 shrink-0" />
                                <span>Tutor asignado: {tutorObj.name}</span>
                              </p>
                              <p className="text-[9.5px] text-indigo-700 font-medium pl-4">
                                ✉️ {tutorObj.email || 'Sin correo registrado'}
                              </p>
                            </div>
                          )}
                          {s.syllabus && (
                            <div className="bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200/80 mt-1.5 space-y-1">
                              <span className="text-[10px] font-bold text-emerald-900 flex items-center gap-1 uppercase tracking-wider">
                                📋 Cronograma y Temas a Trabajar:
                              </span>
                              <p className="text-[11px] text-emerald-850 font-normal whitespace-pre-line leading-relaxed pl-1">
                                {s.syllabus}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => handleCancelBooking(s.id)}
                            className="bg-red-50 hover:bg-red-600 hover:text-white text-red-600 text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
                          >
                            Cancelar Inscripción
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* C. STUDENT HISTORY / RECORD AND HOURS REGISTERED + SATISFACTION EVALUATION */}
          {activeSegment === 'history' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Historial de Asistencia y Encuesta de Satisfacción
                  </h3>
                  <p className="text-xs text-slate-500">
                    Revisa tus asistencias y califica la calidad de las tutorías y talleres a los que asististe.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full self-start sm:self-auto">
                  {myHistory.length} {myHistory.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>

              {myHistory.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl border border-slate-100 text-center space-y-2">
                  <History className="mx-auto h-8 w-8 text-slate-300" />
                  <h4 className="text-xs font-bold text-slate-600">No hay inasistencias ni registros marcados</h4>
                  <p className="text-[11px] text-slate-400">
                    Una vez que asistas a tus reservas, el tutor o docente marcará tu presente en el sistema y podrás evaluarlo.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myHistory.map(s => {
                    const stStatus = s.attendance?.[user.id] || 'pendiente';
                    const feedback = s.ratings?.[user.id];
                    const isPresent = stStatus === 'presente';
                    const tutorObj = s.tutorId ? allUsers.find(u => u.id === s.tutorId) : null;

                    return (
                      <div key={s.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                isPresent 
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                                  : 'bg-amber-50 text-amber-800 border border-amber-100'
                              }`}>
                                {isPresent ? '✓ Asistencia Confirmada' : 'Ausente / No Registrado'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                {s.program === 'tutorias' ? 'Programa Tutorías' : 'Programa Psicoeducativo'}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-[#092c4c] leading-snug">{s.title}</h4>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              📅 {s.date} • ⏰ {s.timeSlot} • 📍 {s.location}
                            </p>
                            {tutorObj && (
                              <p className="text-[11px] text-[#1e40af] font-semibold mt-0.5 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Tutor(a): {tutorObj.name}</span>
                              </p>
                            )}
                          </div>

                          {/* Satisfaction Badge / Rating Button */}
                          <div className="self-start sm:self-auto shrink-0">
                            {feedback ? (
                              <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 text-right space-y-1">
                                <div className="flex items-center justify-end gap-1">
                                  {[1, 2, 3, 4, 5].map(starNum => (
                                    <Star
                                      key={starNum}
                                      className={`w-3.5 h-3.5 ${
                                        starNum <= feedback.rating
                                          ? 'text-amber-400 fill-amber-400'
                                          : 'text-slate-300'
                                      }`}
                                    />
                                  ))}
                                  <span className="text-xs font-bold text-amber-900 ml-1">
                                    {feedback.rating}.0
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEvaluatingSession(s);
                                    setRatingStars(feedback.rating);
                                    setRatingComment(feedback.comment || '');
                                  }}
                                  className="text-[10px] text-amber-700 hover:text-amber-900 underline font-bold cursor-pointer block"
                                >
                                  Modificar mi evaluación
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEvaluatingSession(s);
                                  setRatingStars(5);
                                  setRatingComment('');
                                }}
                                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <Star className="w-3.5 h-3.5 fill-white" />
                                <span>Calificar Tutoría</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Cronograma / Temario Desplegable */}
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => toggleHistorySyllabus(s.id)}
                            className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/70 transition text-xs font-semibold text-slate-700 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="font-bold text-[#092c4c]">Cronograma y Temario</span>
                              {s.syllabus && s.syllabus.trim().length > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Disponible
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 text-slate-600">
                                  Sin temario cargado
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                              <span>{expandedHistorySyllabusIds[s.id] ? 'Ocultar' : 'Ver temario'}</span>
                              {expandedHistorySyllabusIds[s.id] ? (
                                <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </div>
                          </button>

                          {expandedHistorySyllabusIds[s.id] && (
                            <div className="mt-2 p-3.5 bg-indigo-50/60 border border-indigo-150 rounded-xl space-y-1.5 animate-fade-in text-xs">
                              <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-[11px]">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Plan de Trabajo y Contenidos de la Clase:</span>
                              </div>
                              {s.syllabus && s.syllabus.trim().length > 0 ? (
                                <p className="text-slate-700 whitespace-pre-line leading-relaxed italic bg-white p-3 rounded-lg border border-indigo-100 text-[11px]">
                                  "{s.syllabus}"
                                </p>
                              ) : (
                                <p className="text-slate-500 italic bg-white/60 p-2.5 rounded-lg border border-slate-200 text-[11px]">
                                  El tutor no ingresó un temario o cronograma específico para esta sesión.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* If feedback was provided, display student comment */}
                        {feedback && feedback.comment && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase">
                              <MessageSquare className="w-3 h-3" />
                              <span>Tu comentario:</span>
                            </div>
                            <p className="italic text-slate-600 break-words whitespace-pre-wrap">
                              "{feedback.comment}"
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* D. STUDENT DISPONIBILIDAD PROFILE SECTOR */}
          {activeSegment === 'disponibilidad' && myAvailability && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                  <Clock className="h-5 w-5 text-[#3a9ad9]" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Cargar Mi Disponibilidad</h3>
                    <p className="text-[10px] text-slate-400">Selecciona los bloques de horario semanales que tienes libre para que el docente pueda ver tu coincidencia y asignarte horas fijas o tutorías virtuales.</p>
                  </div>
                </div>

                {formFeedback && (
                  <div className="p-3 bg-emerald-55 text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-semibold animate-fade-in flex items-center space-x-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{formFeedback}</span>
                  </div>
                )}

                <div className="space-y-4">
                  {myAvailability.days.map((d, dIdx) => (
                    <div key={d.day} className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-100 space-y-2.5">
                      <span className="text-[11px] font-extrabold uppercase text-[#092c4c] tracking-wider block">
                        {d.day}
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {TIME_SLOTS.map(slot => {
                          const isChecked = d.slots.includes(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => {
                                const newDays = [...myAvailability.days];
                                if (isChecked) {
                                  newDays[dIdx].slots = newDays[dIdx].slots.filter(s => s !== slot);
                                } else {
                                  newDays[dIdx].slots = [...newDays[dIdx].slots, slot];
                                }
                                setMyAvailability({
                                  ...myAvailability,
                                  days: newDays,
                                  updatedAt: new Date().toISOString()
                                });
                              }}
                              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all text-center flex items-center justify-center space-x-1 ${isChecked ? 'bg-[#3a9ad9] border-[#3a9ad9] text-white shadow-xs animate-scale-up' : 'bg-white border-slate-100 text-slate-650 hover:border-slate-300'}`}
                            >
                              <span>{slot}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      const currentList = getSavedAvailabilities();
                      const filtered = currentList.filter(a => a.userId !== user.id);
                      const updatedAvail = {
                        ...myAvailability,
                        updatedAt: new Date().toISOString()
                      };
                      const nextList = [...filtered, updatedAvail];
                      saveAvailabilities(nextList);
                      setMyAvailability(updatedAvail);
                      setFormFeedback("¡Tu disponibilidad horaria ha sido guardada exitosamente en el sistema de Trayectoria UFT!");
                      reloadData();
                      setTimeout(() => setFormFeedback(null), 4000);
                    }}
                    className="bg-[#092c4c] hover:bg-slate-900 text-white font-bold text-xs py-2 px-5 rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Check className="h-4 w-4 text-[#3a9ad9]" />
                    <span>Guardar Mi Disponibilidad Semanal</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* E. STUDENT INCONVENIENTES & MESSAGES SECTOR */}
          {activeSegment === 'inconvenientes' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Avisar Inconveniente Horario o Clase Especial</h3>
                    <p className="text-[10px] text-slate-400">Si un bloque predeterminado de tutoría/taller presenta tope académico con tus ramos de pregrado, envía un aviso formal para planificar una sesión de apoyo flexible individual.</p>
                  </div>
                </div>

                {formFeedback && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-xl text-xs font-semibold animate-fade-in flex items-center space-x-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{formFeedback}</span>
                  </div>
                )}

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!reqMessage.trim()) return;
                  
                  const allReqs = getSavedStudentRequests();
                  const newReq: StudentRequest = {
                    id: 'req_' + Date.now(),
                    studentId: user.id,
                    studentName: user.name,
                    studentCareer: user.career || 'Estudiante',
                    program: reqProgram,
                    message: reqMessage,
                    preferredTime: reqPreferredTime,
                    status: 'pendiente',
                    createdAt: new Date().toISOString()
                  };
                  const updatedReqs = [newReq, ...allReqs];
                  saveStudentRequests(updatedReqs);
                  
                  // Sincronizar en MongoDB Atlas
                  fetch('/api/student-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newReq)
                  }).catch(err => console.warn('Sync student request en Mongo:', err));

                  // 1. Notificar al Alumno confirmando la recepción
                  triggerNotification(
                    user.email,
                    user.name,
                    `Envío de Inconveniente: Solicitud de Clase Flexible`,
                    `Estimado/a ${user.name}, confirmamos la recepción de tu mensaje a coordinación. Tu aviso para el programa de ${reqProgram === 'tutorias' ? 'Tutorías Colectivas' : 'Talleres Psicoeducativos'} ha sido enviado para asignación de horario flexible. Te notificaremos por correo cuando se confirme.`
                  );

                  // 2. Notificar por correo a TODOS los Docentes Coordinadores registrados
                  const allSavedUsers = getSavedUsers();
                  const allDocentes = allSavedUsers.filter(u => u.role === 'docente' && u.email);
                  const progLabel = reqProgram === 'tutorias' ? 'Programa de Tutorías Académicas' : 'Programa de Apoyo Psicoeducativo';
                  const docenteSubject = `[Trayectoria UFT] Nueva Solicitud de Tope Horario / Inconveniente: ${user.name}`;

                  allDocentes.forEach((docente) => {
                    const docenteHtml = `
                      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 30px 15px; min-height: 100%;">
                        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                          <tr>
                            <td style="background: linear-gradient(135deg, #092c4c 0%, #153a5c 100%); padding: 30px 25px; text-align: center;">
                              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Trayectoria <span style="color: #3a9ad9;">UFT.</span></h1>
                              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Coordinación Docente</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 35px 30px 20px 30px;">
                              <div style="text-align: center; margin-bottom: 25px;">
                                <span style="background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 9999px; display: inline-block; letter-spacing: 0.5px;">
                                  ⚠️ Nueva Solicitud de Flexibilidad / Tope Horario
                                </span>
                              </div>

                              <h2 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">
                                Estimados Docentes y Coordinadores,
                              </h2>
                              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 25px 0;">
                                El estudiante <strong>${user.name}</strong> ha presentado un aviso formal por inconveniente / tope de horario y solicita la coordinación de un horario flexible individual.
                              </p>

                              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
                                <h3 style="margin: 0 0 14px 0; color: #092c4c; font-size: 15px; font-weight: 700; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
                                  Ficha de la Solicitud
                                </h3>
                                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>Estudiante:</strong> ${user.name}</p>
                                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>RUT:</strong> ${user.rut}</p>
                                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>Carrera:</strong> ${user.career || 'Estudiante'}</p>
                                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>Correo Alumno:</strong> ${user.email}</p>
                                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>Programa Solicitado:</strong> ${progLabel}</p>
                                <p style="margin: 6px 0; color: #475569; font-size: 13px;"><strong>Disponibilidad Propuesta por Alumno:</strong> <span style="color: #0284c7; font-weight: 700;">${reqPreferredTime}</span></p>
                              </div>

                              <div style="background-color: #f1f5f9; border-left: 4px solid #3a9ad9; padding: 14px 16px; border-radius: 4px; margin-bottom: 25px;">
                                <p style="margin: 0 0 6px 0; color: #092c4c; font-size: 12px; font-weight: 700;">
                                  Mensaje / Motivo del Inconveniente:
                                </p>
                                <p style="margin: 0; color: #334155; font-size: 13px; line-height: 1.5; font-style: italic;">
                                  "${reqMessage}"
                                </p>
                              </div>

                              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
                                Puedes revisar y gestionar esta solicitud directamente desde tu panel docente en la pestaña <strong>Horarios Flexibles</strong> &gt; <strong>Bandeja de Inconvenientes</strong>.
                              </p>
                            </td>
                          </tr>
                          <tr>
                            <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                              <p style="margin: 0; color: #64748b; font-size: 11px;">Centro de Apoyo al Aprendizaje y Trayectoria Estudiantil • Universidad Finis Terrae</p>
                            </td>
                          </tr>
                        </table>
                      </div>
                    `;

                    const docentePlain = `Estimados Docentes y Coordinadores,\n\nEl estudiante ${user.name} (${user.rut}, ${user.career}) ha presentado una solicitud de tope horario para el ${progLabel}.\n\nDisponibilidad propuesta: ${reqPreferredTime}\nMotivo: "${reqMessage}"\nCorreo estudiante: ${user.email}\n\nPueden gestionar esta solicitud desde el panel docente de Trayectoria UFT.`;

                    triggerNotification(
                      docente.email,
                      docente.name,
                      docenteSubject,
                      docentePlain,
                      docenteHtml
                    );
                  });

                  setReqMessage('');
                  setReqPreferredTime('');
                  setFormFeedback(`¡Aviso enviado exitosamente! Se ha notificado por correo a todos los docentes coordinadores (${allDocentes.length} docentes) para gestionar tu solicitud.`);
                  reloadData();
                  setTimeout(() => setFormFeedback(null), 5000);
                }} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 rounded">Área Académica a Notificar</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReqProgram('tutorias')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition-colors ${reqProgram === 'tutorias' ? 'bg-[#092c4c] text-white border-[#092c4c]' : 'bg-white text-slate-650 border-slate-205 hover:bg-slate-50'}`}
                      >
                        Programa de Tutorías UFT
                      </button>
                      <button
                        type="button"
                        onClick={() => setReqProgram('psicoeducativo')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition-colors ${reqProgram === 'psicoeducativo' ? 'bg-[#3a9ad9] text-[#092c4c] border-[#3a9ad9]' : 'bg-white text-slate-650 border-slate-205 hover:bg-slate-50'}`}
                      >
                        Apoyo / Taller Psicoeducativo
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Escribe tu Mensaje de Inconveniente</label>
                    <textarea
                      required
                      placeholder="Ej: Tengo tope con el horario de matemática los martes. Solicito realizar la tutoría en un horario alternativo individual debido a que asisto a laboratorio obligatorio."
                      value={reqMessage}
                      onChange={(e) => setReqMessage(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:border-[#3a9ad9] focus:outline-none h-20 resize-none font-medium bg-slate-50/50"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Tus Horarios Propuestos (Flexibilidad)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Miércoles módulo 15:00 - 16:30 o Viernes 09:00 - 10:30"
                      value={reqPreferredTime}
                      onChange={(e) => setReqPreferredTime(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:focus:border-[#3a9ad9] focus:outline-none font-medium bg-slate-50/50"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#092c4c] hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center space-x-2"
                  >
                    <Send className="h-4 w-4 text-[#3a9ad9]" />
                    <span>Enviar Notificación al Docente</span>
                  </button>
                </form>
              </div>

              {/* Request log / Registro de clases individualizadas */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs space-y-4">
                <h4 className="text-xs font-bold text-[#092c4c] uppercase tracking-wider">Tus Reportes de Coincidencias y Clases Programadas</h4>
                
                {myRequests.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">No has enviado avisos sobre inconvenientes.</p>
                ) : (
                  <div className="space-y-3">
                    {myRequests.map(r => {
                      const linkedSession = r.assignedSessionId 
                        ? sessions.find(s => s.id === r.assignedSessionId) 
                        : null;

                      return (
                        <div key={r.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/20 space-y-2">
                          <div className="flex justify-between items-start">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest ${r.program === 'tutorias' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                              {r.program === 'tutorias' ? 'Programa Tutorías' : 'Psicoeducativo'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'resuelto' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {r.status === 'resuelto' ? 'Clase Efectuada / Asignada' : 'Aviso Pendiente de Revisión'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 italic font-medium">"{r.message}"</p>
                          <p className="text-[10px] text-slate-400 font-bold">Horario propuesto: <strong className="text-slate-600">{r.preferredTime}</strong></p>

                          {r.status === 'resuelto' && linkedSession && (
                            <div className="mt-2.5 pt-2.5 border-t border-dashed border-emerald-200 bg-emerald-50/25 p-3 rounded-lg border border-emerald-100 space-y-1">
                              <span className="text-[9px] uppercase font-extrabold text-[#059669] block">Registro Oficial Clase Efectuada / Coordinada:</span>
                              <h5 className="text-xs font-bold text-slate-800">{linkedSession.title}</h5>
                              <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-4">
                                <span>Fecha: <strong>{linkedSession.date}</strong></span>
                                <span>Módulo: <strong>{linkedSession.timeSlot}</strong></span>
                                <span>Espacio: <strong>{linkedSession.location}</strong></span>
                              </div>
                              <span className="inline-block mt-1.5 text-[9px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded uppercase">
                                Registro de Clase Completo
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
        
      </div>

        {/* Status Bar / Footer matching mockup */}
        <footer className="h-10 bg-[#f1f5f9] border-t border-slate-100 flex items-center justify-between px-6 md:px-8 text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-auto shrink-0 select-none">
          <div>Portal del Estudiante | Trayectoria Estudiantil UFT</div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
              UFT Conectado
            </span>
            <span className="hidden sm:inline">Notaría Instantánea Estudiantil</span>
          </div>
        </footer>
      </main>

      {/* Modal / Panel Flotante de Bandeja de Correo y Comunicados */}
      {showNotifInbox && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowNotifInbox(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#092c4c] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#3a9ad9] flex items-center justify-center text-[#092c4c] font-bold shadow-sm">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Bandeja de Mensajes y Comunicados</h3>
                  <p className="text-[11px] text-slate-300">Avisos oficiales y notificaciones enviadas a {user.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowNotifInbox(false)}
                className="text-slate-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Actions Bar & Timeframe Filter */}
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Mostrar:</span>
                <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setNotifTimeframe('week')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      notifTimeframe === 'week'
                        ? 'bg-white text-[#092c4c] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📅 Última Semana (7 días)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifTimeframe('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      notifTimeframe === 'all'
                        ? 'bg-white text-[#092c4c] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Histórico Completo
                  </button>
                </div>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const marked = notifications.map(n => ({ ...n, read: true }));
                    setNotifications(marked);
                    saveNotifications(marked);
                    try {
                      await fetch('/api/notifications/read-all', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: user.email })
                      });
                    } catch (e) {}
                  }}
                  className="text-brand-celeste hover:text-brand-navy font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Marcar todos como leídos</span>
                </button>
              )}
            </div>

            {/* Messages List */}
            {(() => {
              const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
              const filteredList = notifTimeframe === 'week'
                ? notifications.filter(n => new Date(n.timestamp).getTime() >= sevenDaysAgo)
                : notifications;

              return (
                <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
                  {filteredList.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 space-y-2">
                      <Mail className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="text-xs font-medium">
                        {notifTimeframe === 'week'
                          ? 'No has recibido comunicados ni avisos en los últimos 7 días.'
                          : 'No tienes mensajes en tu bandeja.'}
                      </p>
                      {notifTimeframe === 'week' && notifications.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setNotifTimeframe('all')}
                          className="text-brand-celeste text-[11px] font-bold underline cursor-pointer hover:text-brand-navy"
                        >
                          Ver mensajes anteriores ({notifications.length} en historial)
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredList.map(notif => {
                      const isUnread = !notif.read;
                      return (
                        <div
                          key={notif.id}
                          onClick={async () => {
                            if (isUnread) {
                              const updated = notifications.map(n => n.id === notif.id ? { ...n, read: true } : n);
                              setNotifications(updated);
                              saveNotifications(updated);
                              try {
                                await fetch(`/api/notifications/${notif.id}/read`, { method: 'PUT' });
                              } catch (e) {}
                            }
                          }}
                          className={`p-4 rounded-xl border transition-all cursor-pointer overflow-hidden min-w-0 ${
                            isUnread
                              ? 'bg-sky-50/70 border-[#3a9ad9]/40 shadow-xs'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-[#3a9ad9] shrink-0" title="No leído"></span>
                              )}
                              <h4 className={`text-xs break-words break-all ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                {notif.subject}
                              </h4>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                              {new Date(notif.timestamp).toLocaleString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 whitespace-pre-wrap break-words break-all leading-relaxed pl-4 border-l-2 border-slate-200 my-2 overflow-hidden">
                            {notif.message}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                            <span>Emisor: <strong>Centro de Apoyo UFT</strong></span>
                            {isUnread ? (
                              <span className="text-[#3a9ad9] font-bold">Nuevo</span>
                            ) : (
                              <span className="text-slate-400">Leído</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowNotifInbox(false)}
                className="bg-[#092c4c] hover:bg-[#153a5c] text-white text-xs font-bold py-2 px-5 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Cerrar Bandeja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EVALUACIÓN DE SATISFACCIÓN (1 A 5 ESTRELLAS Y COMENTARIOS) */}
      {evaluatingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden animate-scale-up">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-[#092c4c] to-[#153a5c] text-white p-6 relative">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Evaluación de Satisfacción</h3>
                  <p className="text-xs text-slate-300">Califica la calidad y dinámica de tu sesión académica</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEvaluatingSession(null);
                  setRatingSuccessMsg(null);
                }}
                className="absolute top-5 right-5 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo del Formulario */}
            <form onSubmit={handleSubmitRating} className="p-6 space-y-5">
              {/* Información de la sesión evaluada */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sesión a Evaluar:</span>
                <h4 className="text-sm font-bold text-[#092c4c]">{evaluatingSession.title}</h4>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 font-medium pt-1">
                  <span>📅 {evaluatingSession.date}</span>
                  <span>•</span>
                  <span>⏰ {evaluatingSession.timeSlot}</span>
                  <span>•</span>
                  <span>📍 {evaluatingSession.location}</span>
                </div>
              </div>

              {ratingSuccessMsg ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2 animate-fade-in">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-xs font-bold text-emerald-900">{ratingSuccessMsg}</p>
                </div>
              ) : (
                <>
                  {/* Selector de Estrellas (1 al 5) */}
                  <div className="text-center space-y-2 py-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      ¿Qué te pareció esta sesión? (1 a 5 estrellas)
                    </label>
                    
                    <div className="flex items-center justify-center gap-2 py-1">
                      {[1, 2, 3, 4, 5].map((starValue) => {
                        const isFilled = (ratingHover || ratingStars) >= starValue;
                        return (
                          <button
                            key={starValue}
                            type="button"
                            onMouseEnter={() => setRatingHover(starValue)}
                            onMouseLeave={() => setRatingHover(0)}
                            onClick={() => setRatingStars(starValue)}
                            className="p-1.5 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                          >
                            <Star
                              className={`w-8 h-8 transition-colors ${
                                isFilled
                                  ? 'text-amber-400 fill-amber-400 filter drop-shadow-xs'
                                  : 'text-slate-300 hover:text-amber-300'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>

                    <div className="text-xs font-extrabold text-amber-900">
                      {ratingStars === 1 && '⭐ 1/5 - Requiere Mejorar'}
                      {ratingStars === 2 && '⭐⭐ 2/5 - Regular'}
                      {ratingStars === 3 && '⭐⭐⭐ 3/5 - Buena'}
                      {ratingStars === 4 && '⭐⭐⭐⭐ 4/5 - Muy Buena'}
                      {ratingStars === 5 && '⭐⭐⭐⭐⭐ 5/5 - Excelente Experiencia'}
                    </div>
                  </div>

                  {/* Cuadro de Comentarios y Sugerencias */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Comentarios, Aprendizajes o Sugerencias (Opcional):
                    </label>
                    <textarea
                      rows={4}
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      placeholder="Cuéntanos qué fue lo que más te sirvió, cómo estuvo la explicación del tutor o docente, o si hay temas que te gustaría reforzar..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 focus:bg-white focus:border-brand-celeste focus:ring-2 focus:ring-brand-celeste/20 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setEvaluatingSession(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingRating}
                      className="px-5 py-2.5 rounded-xl bg-[#092c4c] hover:bg-[#153a5c] text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{isSubmittingRating ? 'Guardando...' : 'Enviar Evaluación'}</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Barra de Navegación Inferior para Celulares / Mobile Responsive */}
      <nav 
        aria-label="Navegación móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#092c4c] border-t border-[#153a5c] px-6 py-2.5 shadow-2xl flex items-center justify-around backdrop-blur-md bg-opacity-95"
        style={{ paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveSegment('tutorias');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const mainElem = document.getElementById('student-main-panel-workspace');
            if (mainElem) mainElem.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-5 rounded-2xl transition-all cursor-pointer ${
            activeSegment === 'tutorias'
              ? 'text-white bg-[#153a5c] font-bold shadow-inner'
              : 'text-slate-300 hover:text-white font-medium'
          }`}
        >
          <Home className="w-5 h-5 mb-1 text-[#3a9ad9]" />
          <span className="text-[11px]">Inicio</span>
        </button>

        <button
          type="button"
          onClick={() => setIsQRScannerOpen(true)}
          className="flex flex-col items-center justify-center py-1.5 px-6 rounded-2xl text-[#092c4c] font-extrabold transition-all cursor-pointer bg-gradient-to-r from-[#3a9ad9] to-[#38bdf8] hover:brightness-110 shadow-lg active:scale-95"
        >
          <QrCode className="w-5 h-5 mb-0.5 text-[#092c4c]" />
          <span className="text-[11px]">Escanear QR</span>
        </button>
      </nav>

      {/* Modal de Escáner QR con Cámara para Celular */}
      <MobileQRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        currentUser={user}
        onAttendanceRegistered={() => {
          reloadData();
        }}
      />
    </div>
  );
}
