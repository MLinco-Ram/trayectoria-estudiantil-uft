import React, { useState, useEffect, useMemo } from 'react';
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
  getDynamicPresetDates,
  SATISFACTION_SURVEY_QUESTIONS,
  SURVEY_SCALE_OPTIONS,
  SATISFACTION_SURVEY_INSTRUCTIONS,
  isSessionPast,
  isSessionActive,
  isRegistrationWindowClosed,
  MAX_WEEKLY_ACTIVE_BOOKINGS,
  getStudentActiveBookingsInWeek,
  getWeekKey
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
import { useNavigate } from 'react-router-dom';
import { useAuth, getRoleHomePath } from '../context/AuthContext';
import { MobileQRScannerModal } from './common/MobileQRScannerModal';
import { ThemeToggle } from './common/ThemeToggle';
import { NotificationModal } from './common/NotificationModal';
import { AlumnoTutorialModal } from './alumno/AlumnoTutorialModal';

interface AlumnoDashboardProps {
  user?: User;
  onLogout?: () => void;
  onUpdateUser?: (user: User) => void;
}

export default function AlumnoDashboard({ user: propUser, onLogout: propLogout, onUpdateUser: propUpdateUser }: AlumnoDashboardProps = {}) {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = propUser || auth.currentUser;
  const onLogout = propLogout || auth.logout;
  const onUpdateUser = propUpdateUser || auth.updateUser;

  if (!user) return null;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [notifications, setNotifications] = useState<WebNotification[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>(getSavedUsers());
  
  // Tab view controller with persistence across reloads
  // tutorias, psicoeducativo, my_bookings, history, inconvenientes
  const [activeSegment, setActiveSegment] = useState<'tutorias' | 'psicoeducativo' | 'my_bookings' | 'history' | 'inconvenientes'>(() => {
    const saved = localStorage.getItem('uft_alumno_active_segment');
    if (saved === 'disponibilidad') return 'tutorias';
    return (saved as 'tutorias' | 'psicoeducativo' | 'my_bookings' | 'history' | 'inconvenientes') || 'tutorias';
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
  
  // Guided Tutorial Tour State
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  // Trigger tutorial automatically the first time student enters the portal
  useEffect(() => {
    if (user?.id) {
      const tutorialKey = `uft_alumno_tutorial_shown_${user.id}`;
      const alreadyShown = localStorage.getItem(tutorialKey);
      if (!alreadyShown) {
        const timer = setTimeout(() => {
          setIsTutorialOpen(true);
        }, 700);
        return () => clearTimeout(timer);
      }
    }
  }, [user?.id]);

  const handleCloseTutorial = () => {
    setIsTutorialOpen(false);
    if (user?.id) {
      localStorage.setItem(`uft_alumno_tutorial_shown_${user.id}`, 'true');
    }
  };

  const handleOpenTutorial = () => {
    setIsTutorialOpen(true);
  };

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

  // Feedback & Satisfaction state (Encuesta de Satisfacción de 12 preguntas)
  const [evaluatingSession, setEvaluatingSession] = useState<Session | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<number, number>>({});
  const [ratingComment, setRatingComment] = useState<string>('');
  const [ratingSuccessMsg, setRatingSuccessMsg] = useState<string | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);
  const [showSurveyInstructions, setShowSurveyInstructions] = useState<boolean>(false);

  // Helper para abrir la encuesta con respuestas previas o iniciales
  const handleOpenEvaluationModal = (session: Session) => {
    const existing = session.ratings?.[user.id];
    setEvaluatingSession(session);
    setRatingSuccessMsg(null);
    if (existing) {
      setRatingComment(existing.comment || '');
      if (existing.answers && Object.keys(existing.answers).length > 0) {
        setSurveyAnswers(existing.answers);
      } else {
        const initialMap: Record<number, number> = {};
        SATISFACTION_SURVEY_QUESTIONS.forEach(q => {
          initialMap[q.id] = existing.rating || 5;
        });
        setSurveyAnswers(initialMap);
      }
    } else {
      const initialMap: Record<number, number> = {};
      SATISFACTION_SURVEY_QUESTIONS.forEach(q => {
        initialMap[q.id] = 5;
      });
      setSurveyAnswers(initialMap);
      setRatingComment('');
    }
  };

  const handleSetAnswer = (questionId: number, score: number) => {
    setSurveyAnswers(prev => ({
      ...prev,
      [questionId]: score
    }));
  };

  const handleSetAllAnswers = (score: number) => {
    const newAnswers: Record<number, number> = {};
    SATISFACTION_SURVEY_QUESTIONS.forEach(q => {
      newAnswers[q.id] = score;
    });
    setSurveyAnswers(newAnswers);
  };

  // Expandable syllabus state for history classes
  const [expandedHistorySyllabusIds, setExpandedHistorySyllabusIds] = useState<Record<string, boolean>>({});

  const toggleHistorySyllabus = (sessionId: string) => {
    setExpandedHistorySyllabusIds(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  // Submit Satisfaction Evaluation (12 preguntas)
  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingSession) return;

    const totalQuestions = SATISFACTION_SURVEY_QUESTIONS.length;
    const sum = SATISFACTION_SURVEY_QUESTIONS.reduce((acc, q) => acc + (surveyAnswers[q.id] || 5), 0);
    const calculatedAvg = Math.round((sum / totalQuestions) * 10) / 10;

    setIsSubmittingRating(true);
    const feedbackObj = {
      studentId: user.id,
      studentName: user.name,
      rating: calculatedAvg,
      answers: surveyAnswers,
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
    setRatingSuccessMsg('¡Muchas gracias! Tu encuesta de satisfacción de 12 preguntas ha sido registrada con éxito.');
    setTimeout(() => {
      setEvaluatingSession(null);
      setRatingSuccessMsg(null);
      setRatingComment('');
      setSurveyAnswers({});
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
    const handleSessionsUpdate = (payload: any) => {
      if (payload?.session && payload.action === 'update') {
        setSessions(prev => {
          const updated = prev.map(s => s.id === payload.session.id ? payload.session : s);
          saveSessions(updated);
          return updated;
        });
      } else if (payload?.session && payload.action === 'create') {
        setSessions(prev => {
          const updated = [payload.session, ...prev.filter(s => s.id !== payload.session.id)];
          saveSessions(updated);
          return updated;
        });
      } else if (payload?.sessionId && payload.action === 'delete') {
        setSessions(prev => {
          const updated = prev.filter(s => s.id !== payload.sessionId);
          saveSessions(updated);
          return updated;
        });
      } else {
        reloadData();
      }
    };

    const handleRealtimeUpdate = () => {
      reloadData();
    };

    socket.on('sessions:changed', handleSessionsUpdate);
    socket.on('student_requests:changed', handleRealtimeUpdate);
    socket.on('notifications:changed', handleRealtimeUpdate);
    socket.on('users:changed', handleRealtimeUpdate);
    socket.on('availabilities:changed', handleRealtimeUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      socket.off('sessions:changed', handleSessionsUpdate);
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
            const sorted = notifsFromApi.sort((a: WebNotification, b: WebNotification) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setNotifications(sorted);
            saveNotifications(sorted);
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
        if (Array.isArray(usersFromApi)) {
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
        if (Array.isArray(reqsFromApi)) {
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
        if (Array.isArray(sessionsFromApi)) {
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

    // Regla de Protección de Tutorías Personalizadas / Asesorías Individuales:
    // Las sesiones personalizadas (1 a 1) o individuales solo son visibles para el estudiante asignado o si están libres para él
    const isPersonalized = s.type === 'tutoria_personalizada' || s.type === 'psico_asesoria_individual' || s.maxSpots === 1;
    if (isPersonalized) {
      const isAssignedToThisStudent = s.studentIds.includes(user.id);
      // Si ya tiene asignado a otro estudiante, o es una sesión 1 a 1 no dirigida a este estudiante, ocultarla
      if (!isAssignedToThisStudent && s.studentIds.length > 0) {
        return false;
      }
    }

    return isProgramMatch && isDateMatch;
  });

  // Próximas sesiones disponibles en el programa activo para facilitar la navegación
  const upcomingProgramSessions = useMemo(() => {
    return sessions
      .filter(s => {
        if (s.program !== activeSegment) return false;
        if (s.isCompleted || isSessionPast(s)) return false;

        const isPersonalized = s.type === 'tutoria_personalizada' || s.type === 'psico_asesoria_individual' || s.maxSpots === 1;
        if (isPersonalized) {
          const isAssignedToThisStudent = s.studentIds.includes(user.id);
          if (!isAssignedToThisStudent && s.studentIds.length > 0) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));
  }, [sessions, activeSegment, user.id]);

  // Fechas únicas con sesiones programadas vigentes
  const upcomingProgramDates = useMemo(() => {
    return Array.from(new Set(upcomingProgramSessions.map(s => s.date)));
  }, [upcomingProgramSessions]);

  // Active bookings where student is registered and session is active (not past and not completed)
  const myActiveBookings = sessions.filter(s => 
    s.studentIds.includes(user.id) && 
    !s.isCompleted && 
    !isSessionPast(s) && 
    s.attendance?.[user.id] !== 'presente' && 
    s.attendance?.[user.id] !== 'ausente'
  );
  
  // Weekly active bookings for the current week (from Monday to Sunday)
  const currentWeekActiveBookings = sessions.filter(s => {
    if (!s.studentIds.includes(user.id)) return false;
    if (s.isCompleted || isSessionPast(s)) return false;
    if (s.attendance?.[user.id] === 'presente' || s.attendance?.[user.id] === 'ausente') return false;
    return getWeekKey(s.date) === getWeekKey(getTodayDateStr());
  });

  // Weekly active bookings for the selected target date's week
  const targetWeekActiveBookings = sessions.filter(s => {
    if (!s.studentIds.includes(user.id)) return false;
    if (s.isCompleted || isSessionPast(s)) return false;
    if (s.attendance?.[user.id] === 'presente' || s.attendance?.[user.id] === 'ausente') return false;
    return getWeekKey(s.date) === getWeekKey(targetDate);
  });

  // History of completed or past/archived classes
  const myHistory = sessions.filter(s => 
    s.studentIds.includes(user.id) && 
    (s.isCompleted || isSessionPast(s) || s.attendance?.[user.id] === 'presente' || s.attendance?.[user.id] === 'ausente')
  );

  // Enroll student in an group session / workshop
  const handleRegisterSlot = (session: Session) => {
    // Check if already registered
    if (session.studentIds.includes(user.id)) {
      setBookingFeedback('Ya te encuentras registrado en este bloque horario.');
      return;
    }

    // Validación estricta para sesiones personalizadas / individuales (1 a 1)
    const isPersonalized = session.type === 'tutoria_personalizada' || session.type === 'psico_asesoria_individual' || session.maxSpots === 1;
    if (isPersonalized && session.studentIds.length > 0 && !session.studentIds.includes(user.id)) {
      setBookingFeedback('⚠️ Esta tutoría es de carácter personalizado y ya se encuentra asignada exclusivamente a otro estudiante.');
      return;
    }

    // Check if session has ended or is archived/completed
    if (isSessionPast(session) || session.isCompleted) {
      setBookingFeedback('⚠️ Esta tutoría ya ha finalizado y se encuentra archivada, por lo que no es posible inscribirse.');
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

    // Regla Institucional Estricta: Un estudiante nunca puede superar 5 reservas activas en la misma semana
    // (Esta regla solo puede ser omitida cuando un docente/coordinador asigna una tutoría personalizada)
    const activeInWeek = getStudentActiveBookingsInWeek(sessions, user.id, session.date);
    if (activeInWeek.length >= MAX_WEEKLY_ACTIVE_BOOKINGS) {
      setBookingFeedback(`⚠️ Límite semanal alcanzado: No es posible tener más de ${MAX_WEEKLY_ACTIVE_BOOKINGS} reservas activas en una misma semana (tienes ${activeInWeek.length}/${MAX_WEEKLY_ACTIVE_BOOKINGS}). Si requieres apoyo adicional extraordinario, solicita una tutoría personalizada.`);
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

    // Notificar al alumno de forma minimalista protegiendo datos sensibles
    triggerNotification(
      user.email,
      user.name,
      `Confirmación de Reserva: ${session.title}`,
      `has reservado tu cupo en la tutoria "${session.title}" del día ${session.date}. Ingresa a la plataforma para revisar los detalles completos.`
    );

    setBookingFeedback("¡Inscripción confirmada! Te hemos enviado el comprobante a tu correo institucional.");
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
          `has liberado tu cupo en la tutoria "${targetSession.title}" del día ${targetSession.date}.`
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
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200" id="alumno-dashboard-wrapper">
      {/* Top Header Navigation Bar */}
      <header className="bg-[#092c4c] dark:bg-slate-900 text-white shadow-md sticky top-0 z-40 border-b border-[#153a5c] dark:border-slate-800 select-none">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Logo e Identidad Institucional */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white p-1 rounded-lg flex items-center justify-center shadow-xs">
                <img src="/logo-uft.png" alt="UFT" className="h-6 w-auto object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-tight leading-none text-white">
                  Trayectoria <span className="text-[#3a9ad9]">UFT</span>
                </span>
                <span className="text-[10px] text-slate-300 dark:text-slate-400 font-medium">
                  Portal Alumno
                </span>
              </div>
            </div>

            {/* Navegación Superior Horizontal Principal */}
            <nav id="alumno-desktop-nav-bar" className="hidden md:flex items-center gap-1.5 lg:gap-2 overflow-x-auto py-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveSegment('tutorias')}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeSegment === 'tutorias'
                    ? 'bg-[#3a9ad9] text-[#092c4c] shadow-sm font-black'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Award className="h-4 w-4 lg:h-4.5 lg:w-4.5 shrink-0" />
                <span>Tutorías Colectivas</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSegment('psicoeducativo')}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeSegment === 'psicoeducativo'
                    ? 'bg-[#3a9ad9] text-[#092c4c] shadow-sm font-black'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <BookOpen className="h-4 w-4 lg:h-4.5 lg:w-4.5 shrink-0" />
                <span>Talleres Psicoeducativos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSegment('my_bookings')}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap relative ${
                  activeSegment === 'my_bookings'
                    ? 'bg-[#3a9ad9] text-[#092c4c] shadow-sm font-black'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Grid className="h-4 w-4 lg:h-4.5 lg:w-4.5 shrink-0" />
                <span>Mis Reservas</span>
                {myActiveBookings.length > 0 && (
                  <span className={`px-1.5 lg:px-2 py-0.2 rounded-full text-[10px] font-black ${
                    activeSegment === 'my_bookings' ? 'bg-[#092c4c] text-white' : 'bg-amber-500 text-white'
                  }`}>
                    {myActiveBookings.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveSegment('history')}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeSegment === 'history'
                    ? 'bg-[#3a9ad9] text-[#092c4c] shadow-sm font-black'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <History className="h-4 w-4 lg:h-4.5 lg:w-4.5 shrink-0" />
                <span>Historial</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSegment('inconvenientes')}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeSegment === 'inconvenientes'
                    ? 'bg-[#3a9ad9] text-[#092c4c] shadow-sm font-black'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <AlertCircle className="h-4 w-4 lg:h-4.5 lg:w-4.5 text-amber-300 shrink-0" />
                <span>Inconvenientes</span>
              </button>
            </nav>

            {/* Acciones Derecha (Bandeja, ThemeToggle, Perfil y Logout) */}
            <div id="alumno-header-actions-group" className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowNotifInbox(prev => !prev)}
                className={`relative p-2 rounded-xl transition-all cursor-pointer ${
                  showNotifInbox
                    ? 'bg-[#3a9ad9] text-[#092c4c]'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200'
                }`}
                title="Bandeja de Correo y Comunicados"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#e28743] text-white px-1.5 py-0.2 rounded-full text-[9px] font-extrabold border-2 border-[#092c4c]">
                    {unreadCount}
                  </span>
                )}
              </button>

              <ThemeToggle />

              {/* Botón de Tutorial Replay (!) */}
              <button
                type="button"
                onClick={handleOpenTutorial}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95 shrink-0"
                title="Ver Tutorial del Portal (!)"
                aria-label="Ver Tutorial del Portal"
                id="alumno-tutorial-replay-btn"
              >
                <span className="text-sm font-black leading-none font-mono">!</span>
              </button>

              {/* Perfil del Alumno con Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition cursor-pointer border border-white/10"
                >
                  <UserIcon className="h-3.5 w-3.5 text-[#3a9ad9]" />
                  <span className="max-w-[120px] truncate hidden sm:inline">{user.name}</span>
                  <ChevronDown className="h-3 w-3 text-slate-300" />
                </button>

                {showLogoutDropdown && (
                  <div className="bg-[#0a0a0a] border border-white/15 rounded-xl p-3 space-y-2.5 animate-fade-in text-xs absolute right-0 z-50 shadow-2xl top-[110%] w-60">
                    <div className="pb-2 border-b border-white/10 text-[11px] text-slate-300 space-y-0.5">
                      <p className="font-extrabold text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-[#3a9ad9] truncate">{user.career || 'Estudiante UFT'}</p>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">RUT: {user.rut}</p>
                    </div>

                    {Array.isArray(user.roles) && user.roles.length > 1 && (
                      <div className="pb-2 border-b border-white/10 space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cambiar de Portal</p>
                        <div className="space-y-1">
                          {user.roles.filter(r => r !== 'alumno').map(r => {
                            if (r === 'tutor') {
                              const userTutorTypes = Array.isArray(user.tutorTypes) && user.tutorTypes.length > 0
                                ? user.tutorTypes
                                : [user.tutorType || 'tutor_par'];
                              const hasBoth = userTutorTypes.includes('tutor_par') && userTutorTypes.includes('tutor_de_tutores');

                              if (hasBoth) {
                                return (
                                  <React.Fragment key="tutor_options">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowLogoutDropdown(false);
                                        auth.login({ ...user, role: 'tutor', tutorType: 'tutor_par' });
                                        navigate('/tutor');
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-white transition flex items-center justify-between text-[11px] font-semibold cursor-pointer border border-emerald-500/20"
                                    >
                                      <span>🧑‍🏫 Portal Tutor Par</span>
                                      <span className="text-[10px] text-emerald-400 font-bold">Ir &rarr;</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowLogoutDropdown(false);
                                        auth.login({ ...user, role: 'tutor', tutorType: 'tutor_de_tutores' });
                                        navigate('/tutor');
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white transition flex items-center justify-between text-[11px] font-semibold cursor-pointer border border-indigo-500/20"
                                    >
                                      <span>🛡️ Portal Tutor de Tutores</span>
                                      <span className="text-[10px] text-indigo-400 font-bold">Ir &rarr;</span>
                                    </button>
                                  </React.Fragment>
                                );
                              }

                              const isLead = userTutorTypes.includes('tutor_de_tutores') || user.tutorType === 'tutor_de_tutores';
                              return (
                                <button
                                  key="tutor"
                                  type="button"
                                  onClick={() => {
                                    setShowLogoutDropdown(false);
                                    auth.login({ ...user, role: 'tutor', tutorType: isLead ? 'tutor_de_tutores' : 'tutor_par' });
                                    navigate('/tutor');
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white transition flex items-center justify-between text-[11px] font-semibold cursor-pointer"
                                >
                                  <span>{isLead ? '🛡️ Portal Tutor de Tutores' : '🧑‍🏫 Portal Tutor Par'}</span>
                                  <span className="text-[10px] text-[#3a9ad9] font-bold">Ir &rarr;</span>
                                </button>
                              );
                            }

                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  setShowLogoutDropdown(false);
                                  auth.login({ ...user, role: r });
                                  navigate(getRoleHomePath(r));
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white transition flex items-center justify-between text-[11px] font-semibold cursor-pointer"
                              >
                                <span>{r === 'docente' ? '👨‍🏫 Portal Docente' : '🛡️ Panel Administrador'}</span>
                                <span className="text-[10px] text-[#3a9ad9] font-bold">Ir &rarr;</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowLogoutDropdown(false);
                        handleOpenTutorial();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-white transition flex items-center justify-between text-[11px] font-semibold cursor-pointer border border-amber-500/20"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-amber-400">!</span>
                        <span>Ver Tutorial del Portal</span>
                      </span>
                      <span className="text-[10px] text-amber-400 font-bold">Abrir &rarr;</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowLogoutDropdown(false);
                        onLogout();
                      }}
                      className="w-full bg-red-650 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-200" id="student-main-panel-workspace">

        {/* Content Section Wrapper */}
        <div className="flex-1 p-3 sm:p-6 md:p-8 pb-28 md:pb-8 max-w-4xl w-full mx-auto" id="alumno-main-dynamic-card-viewport">
        
        {/* Profile Info matching student card - Compact & responsive */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 sm:p-5 space-y-3.5 relative overflow-hidden transition-colors" id="student-main-profile-card">
          <div className="absolute top-0 right-0 bg-brand-celeste/20 text-brand-navy dark:text-sky-300 rounded-bl-xl px-2.5 py-0.5 sm:px-3 sm:py-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">
            PREGRADO UFT
          </div>

          <div className="pt-1">
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold uppercase text-slate-800 dark:text-white tracking-tight leading-tight truncate">
                {user.name}
              </h2>
              <p className="text-xs text-brand-celeste font-bold truncate">{user.career}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">RUT: {user.rut}</p>
            </div>
          </div>

          {/* Booking Metrics */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div 
              onClick={() => setActiveSegment('my_bookings')}
              className="bg-slate-50 dark:bg-slate-800/60 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-center cursor-pointer hover:border-brand-celeste transition-colors"
              title={`Tienes ${currentWeekActiveBookings.length} reservas activas esta semana (máximo ${MAX_WEEKLY_ACTIVE_BOOKINGS}).`}
            >
              <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400 font-semibold uppercase block">Reservas Semanales</span>
              <span className="text-base sm:text-lg font-bold text-brand-navy dark:text-sky-300 block mt-0.5">{currentWeekActiveBookings.length} / {MAX_WEEKLY_ACTIVE_BOOKINGS}</span>
            </div>
            <div 
              onClick={() => setActiveSegment('history')}
              className="bg-slate-50 dark:bg-slate-800/60 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-center cursor-pointer hover:border-brand-celeste transition-colors"
            >
              <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400 font-semibold uppercase block">Asistencias</span>
              <span className="text-base sm:text-lg font-bold text-brand-navy dark:text-sky-300 block mt-0.5">{myHistory.length}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Booking Screen Section */}
        <div className="mt-4 sm:mt-5 space-y-4" id="alumno-segment-body">
          
          {bookingFeedback && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold animate-fade-in flex items-center space-x-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{bookingFeedback}</span>
            </div>
          )}

          {/* Date Picker (Calendar selector widget shown above slot cards in reference gym mockup) */}
          {(activeSegment === 'tutorias' || activeSegment === 'psicoeducativo') && (
            <div id="alumno-date-picker-card" className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-100 dark:border-slate-800 p-3.5 sm:p-4 space-y-3 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Selecciona una Fecha
                  </label>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Navega por los días o elige una fecha específica en el calendario
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#3a9ad9]" />
                    <span>Ir a fecha:</span>
                  </span>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => {
                      if (e.target.value) setTargetDate(e.target.value);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none">
                {presetDates.map(d => {
                  const dateObj = new Date(d + "T00:00:00");
                  const weekday = dateObj.toLocaleDateString('es-ES', { weekday: 'short' });
                  const day = dateObj.getDate();
                  const isCur = d === targetDate;
                  const countForDay = sessions.filter(
                    s => s.program === activeSegment && 
                         s.date === d && 
                         !s.isCompleted && 
                         !isSessionPast(s) &&
                         !(s.maxSpots === 1 && s.studentIds.length >= 1 && !s.studentIds.includes(user.id))
                  ).length;

                  return (
                    <button
                      key={d}
                      onClick={() => setTargetDate(d)}
                      className={`flex-1 min-w-[58px] py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer relative ${
                        isCur
                          ? 'bg-[#092c4c] dark:bg-[#3a9ad9] border-[#092c4c] dark:border-[#3a9ad9] text-white dark:text-slate-900 font-bold shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:border-brand-celeste'
                      }`}
                    >
                      <span className="block text-[8px] uppercase">{weekday}</span>
                      <span className="block text-xs sm:text-sm">{day}</span>
                      {countForDay > 0 && (
                        <span className={`inline-block text-[8px] font-extrabold px-1 rounded-full ${
                          isCur ? 'bg-[#3a9ad9] text-[#092c4c] dark:bg-[#092c4c] dark:text-white' : 'bg-blue-100 dark:bg-sky-950 text-[#092c4c] dark:text-sky-300'
                        }`}>
                          {countForDay} {countForDay === 1 ? 'sesión' : 'sesiones'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Fechas adicionales con sesiones fuera de los días predeterminados */}
              {upcomingProgramDates.filter(d => !presetDates.includes(d)).length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">
                    Otras fechas con sesiones programadas:
                  </span>
                  {upcomingProgramDates.filter(d => !presetDates.includes(d)).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTargetDate(d)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                        targetDate === d
                          ? 'bg-[#3a9ad9] text-[#092c4c]'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      <span>{d}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* A. BOOK SCHEDULER VIEW (Tutorias General and Psycoeducational sessions) */}
            {(activeSegment === 'tutorias' || activeSegment === 'psicoeducativo') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pl-1.5 mt-2">
                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Módulos de Horario Disponibles ({targetDate})
                </h3>
                {availableSchedules.length > 0 && (
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {availableSchedules.length} {availableSchedules.length === 1 ? 'disponible' : 'disponibles'}
                  </span>
                )}
              </div>

              {targetDate < getTodayDateStr() && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>La fecha seleccionada ({targetDate}) ya pasó. Las tutorías anteriores se encuentran archivadas y no admiten nuevas inscripciones.</span>
                </div>
              )}

              {availableSchedules.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-2xl border border-slate-100 dark:border-slate-800 text-center space-y-3 transition-colors">
                  <Calendar className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-bold">No hay cupos disponibles el {targetDate}</p>
                  
                  {upcomingProgramDates.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        ¡Hay sesiones y tutorías programadas en las siguientes fechas! Selecciona una para inscribirte:
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 pt-1">
                        {upcomingProgramDates.map(d => {
                          const dateObj = new Date(d + "T00:00:00");
                          const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                          const count = sessions.filter(
                            s => s.program === activeSegment && 
                                 s.date === d && 
                                 !s.isCompleted && 
                                 !isSessionPast(s) &&
                                 !(s.maxSpots === 1 && s.studentIds.length >= 1 && !s.studentIds.includes(user.id))
                          ).length;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setTargetDate(d)}
                              className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-sky-950/50 hover:bg-[#3a9ad9] hover:text-[#092c4c] text-[#092c4c] dark:text-sky-300 border border-blue-200 dark:border-sky-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span className="capitalize">{dayName}</span>
                              <span className="bg-[#092c4c] text-white dark:bg-[#3a9ad9] dark:text-slate-900 text-[9px] px-1.5 py-0.2 rounded-full font-extrabold">
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Pregunta a tu coordinador si hay tutorías personalizadas o de apoyo extraordinario para habilitar.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="academic-visual-slots-grid">
                  {availableSchedules.map(session => {
                    const enrolledCount = session.studentIds.length;
                    const isRegistered = session.studentIds.includes(user.id);
                    const isFull = enrolledCount >= session.maxSpots;
                    const isPast = isSessionPast(session);
                    const isCompleted = !!session.isCompleted;
                    const isClosedDeadline = isRegistrationWindowClosed(session.date, session.timeSlot);
                    const tutorObj = session.tutorId ? allUsers.find(u => u.id === session.tutorId) : null;

                    return (
                      <div 
                        key={session.id} 
                        className={`bg-white dark:bg-slate-900 rounded-xl border p-4 text-center transition-all flex flex-col justify-between space-y-2.5 ${isRegistered ? 'border-brand-celeste ring-1 ring-brand-celeste/40 bg-blue-50/10 dark:bg-sky-950/20' : isPast || isCompleted ? 'border-slate-200 dark:border-slate-800 opacity-85' : 'border-slate-100 dark:border-slate-800 hover:border-brand-celeste dark:hover:border-brand-celeste'}`}
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-extrabold text-slate-800 dark:text-white block">
                            {session.timeSlot}
                          </span>
                          <span className="text-[11px] text-[#092c4c] dark:text-sky-300 block font-bold mt-0.5 leading-snug">
                            {session.title}
                          </span>

                          {session.subject && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                              📚 {session.subject}
                            </span>
                          )}

                          {session.location && (
                            <span className="text-[9.5px] text-slate-400 dark:text-slate-500 block truncate font-medium">
                              📍 {session.location}
                            </span>
                          )}

                          {tutorObj && (
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 px-2 py-1 rounded-md text-[10px] font-bold text-indigo-900 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center gap-1 mt-1">
                              <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                              <span>Tutor: {tutorObj.name}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                            <span className="inline-block text-[9px] text-indigo-800 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 font-semibold rounded px-2">
                              {enrolledCount}/{session.maxSpots} cupos
                            </span>
                            {(isPast || isCompleted) && (
                              <span className="inline-block text-[8px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 font-bold rounded px-1.5 border border-slate-200 dark:border-slate-700">
                                🔒 Archivada
                              </span>
                            )}
                            {!isPast && !isCompleted && isClosedDeadline && !isRegistered && (
                              <span className="inline-block text-[8px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 font-bold rounded px-1.5 border border-amber-200 dark:border-amber-800">
                                ⏱️ Cierre &lt;2h
                              </span>
                            )}
                          </div>
                          {session.syllabus && (
                            <div className="mt-2 bg-indigo-50/70 dark:bg-indigo-950/40 p-1.5 rounded text-[9.5px] text-indigo-900 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-900 text-left line-clamp-2" title={session.syllabus}>
                              <span className="font-bold">📋 Temario:</span> {session.syllabus}
                            </div>
                          )}
                        </div>

                        {isRegistered ? (
                          <div className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 rounded-lg text-[9px] font-bold py-1.5 flex items-center justify-center space-x-1 border border-emerald-100 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{isPast || isCompleted ? 'En Historial' : 'Reservado'}</span>
                          </div>
                        ) : (isPast || isCompleted) ? (
                          <div 
                            className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[9px] font-bold py-1.5 border border-slate-200 dark:border-slate-700 select-none cursor-not-allowed flex items-center justify-center space-x-1"
                            title="Esta tutoría ya finalizó y se encuentra archivada."
                          >
                            <span>Archivada / Finalizada</span>
                          </div>
                        ) : isFull ? (
                          <div className="bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 rounded-lg text-[9px] font-bold py-1.5 border border-red-100 dark:border-red-900 select-none">
                            Lleno
                          </div>
                        ) : isClosedDeadline ? (
                          <div 
                            className="bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg text-[9px] font-bold py-1.5 border border-slate-200 dark:border-slate-700 select-none cursor-not-allowed"
                            title="El plazo de inscripción cerró porque faltan menos de 2 horas para el inicio de la sesión."
                          >
                            Plazo Cerrado (&lt;2h)
                          </div>
                        ) : targetWeekActiveBookings.length >= MAX_WEEKLY_ACTIVE_BOOKINGS ? (
                          <div 
                            className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-lg text-[9px] font-bold py-1.5 border border-amber-200 dark:border-amber-800 select-none cursor-not-allowed text-center"
                            title={`Has alcanzado el límite institucional de ${MAX_WEEKLY_ACTIVE_BOOKINGS} reservas activas para esta semana. Si requieres apoyo adicional extraordinario, solicita una tutoría personalizada.`}
                          >
                            Límite Semanal (5/5)
                          </div>
                        ) : (
                          <button
                            onClick={() => handleRegisterSlot(session)}
                            className="w-full bg-[#092c4c] dark:bg-brand-celeste hover:bg-slate-900 dark:hover:bg-sky-400 text-white dark:text-[#092c4c] font-bold text-[10px] py-2 rounded-lg cursor-pointer transition-colors uppercase tracking-wide shadow-xs"
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
              <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1.5">
                Mis Tutorías y Talleres Reservados
              </h3>

              {myActiveBookings.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-2xl border border-slate-100 dark:border-slate-800 text-center space-y-2 transition-colors">
                  <Clock className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300">No tienes reservas activas</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Usa el menú arriba para elegir el programa de interés e inscribirte.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {myActiveBookings.map(s => {
                    const tutorObj = s.tutorId ? allUsers.find(t => t.id === s.tutorId) : null;
                    return (
                      <div key={s.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                              {s.program === 'tutorias' ? 'Programa Tutorías' : 'Módulo Psicoeducativo'}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-snug mt-0.5">{s.title}</h4>
                          </div>

                          <span className="bg-blue-50 dark:bg-sky-950/60 text-brand-navy dark:text-sky-300 rounded font-mono font-bold text-[10px] px-2 py-0.5 whitespace-nowrap">
                            {s.date}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-1 border-t border-slate-50 dark:border-slate-800">
                          <p className="flex items-center space-x-1.5">
                            <Clock className="h-3 w-3 text-slate-400 inline mr-1" />
                            <span>Horario: {s.timeSlot}</span>
                          </p>
                          <p className="flex items-center space-x-1.5">
                            <MapPin className="h-3 w-3 text-slate-400 inline mr-1" />
                            <span>Ubicación: {s.location}</span>
                          </p>
                          {tutorObj && (
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-100/80 dark:border-indigo-900 space-y-0.5">
                              <p className="flex items-center space-x-1.5 text-indigo-900 dark:text-indigo-200 font-bold">
                                <UserCheck className="h-3 w-3 text-indigo-600 inline mr-1 shrink-0" />
                                <span>Tutor(a) asignado(a): {tutorObj.name}</span>
                              </p>
                              <p className="text-[9.5px] text-indigo-700 dark:text-indigo-400 font-medium pl-4">
                                🎓 {tutorObj.career || 'Tutor Par UFT'}
                              </p>
                            </div>
                          )}
                          {s.syllabus && (
                            <div className="bg-emerald-50/80 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800 mt-1.5 space-y-1">
                              <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1 uppercase tracking-wider">
                                📋 Cronograma y Temas a Trabajar:
                              </span>
                              <p className="text-[11px] text-emerald-850 dark:text-emerald-200 font-normal whitespace-pre-line leading-relaxed pl-1">
                                {s.syllabus}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => handleCancelBooking(s.id)}
                            className="bg-red-50 dark:bg-red-950/40 hover:bg-red-600 hover:text-white text-red-600 dark:text-red-400 text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer"
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                    Historial de Asistencia y Encuesta de Satisfacción
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Revisa tus asistencias y califica la calidad de las tutorías y talleres a los que asististe.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full self-start sm:self-auto">
                  {myHistory.length} {myHistory.length === 1 ? 'registro' : 'registros'}
                </span>
              </div>

              {myHistory.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-2xl border border-slate-100 dark:border-slate-800 text-center space-y-2 transition-colors">
                  <History className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300">No hay inasistencias ni registros marcados</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
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
                      <div key={s.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                isPresent 
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800' 
                                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-800'
                              }`}>
                                {isPresent ? '✓ Asistencia Confirmada' : 'Ausente / No Registrado'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                {s.program === 'tutorias' ? 'Programa Tutorías' : 'Programa Psicoeducativo'}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-[#092c4c] dark:text-white leading-snug">{s.title}</h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                              📅 {s.date} • ⏰ {s.timeSlot} • 📍 {s.location}
                            </p>
                            {tutorObj && (
                              <p className="text-[11px] text-[#1e40af] dark:text-sky-400 font-semibold mt-0.5 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Tutor(a): {tutorObj.name}</span>
                              </p>
                            )}
                          </div>

                          {/* Satisfaction Badge / Rating Button */}
                          <div className="self-start sm:self-auto shrink-0">
                            {feedback ? (
                              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl p-2.5 text-right space-y-1">
                                <div className="flex items-center justify-end gap-1">
                                  {[1, 2, 3, 4, 5].map(starNum => (
                                    <Star
                                      key={starNum}
                                      className={`w-3.5 h-3.5 ${
                                        starNum <= feedback.rating
                                          ? 'text-amber-400 fill-amber-400'
                                          : 'text-slate-300 dark:text-slate-600'
                                      }`}
                                    />
                                  ))}
                                  <span className="text-xs font-bold text-amber-900 dark:text-amber-300 ml-1">
                                    {feedback.rating}.0
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEvaluationModal(s)}
                                  className="text-[10px] text-amber-700 dark:text-amber-400 hover:text-amber-900 underline font-bold cursor-pointer block"
                                >
                                  Modificar mi evaluación (12 preguntas)
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenEvaluationModal(s)}
                                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <Star className="w-3.5 h-3.5 fill-white" />
                                <span>Responder Encuesta (12 Preguntas)</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Cronograma / Temario Desplegable */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => toggleHistorySyllabus(s.id)}
                            className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100/80 dark:hover:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700 transition text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                              <span className="font-bold text-[#092c4c] dark:text-slate-200">Cronograma y Temario</span>
                              {s.syllabus && s.syllabus.trim().length > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Disponible
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                  Sin temario cargado
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                              <span>{expandedHistorySyllabusIds[s.id] ? 'Ocultar' : 'Ver temario'}</span>
                              {expandedHistorySyllabusIds[s.id] ? (
                                <ChevronUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </div>
                          </button>

                          {expandedHistorySyllabusIds[s.id] && (
                            <div className="mt-2 p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-150 dark:border-indigo-900 rounded-xl space-y-1.5 animate-fade-in text-xs">
                              <div className="flex items-center gap-1.5 text-indigo-950 dark:text-indigo-200 font-bold text-[11px]">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>Plan de Trabajo y Contenidos de la Clase:</span>
                              </div>
                              {s.syllabus && s.syllabus.trim().length > 0 ? (
                                <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed italic bg-white dark:bg-slate-900 p-3 rounded-lg border border-indigo-100 dark:border-indigo-950 text-[11px]">
                                  "{s.syllabus}"
                                </p>
                              ) : (
                                <p className="text-slate-500 dark:text-slate-400 italic bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]">
                                  El tutor no ingresó un temario o cronograma específico para esta sesión.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* If feedback was provided, display student comment */}
                        {feedback && feedback.comment && (
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase">
                              <MessageSquare className="w-3 h-3" />
                              <span>Tu comentario:</span>
                            </div>
                            <p className="italic text-slate-600 dark:text-slate-300 break-words whitespace-pre-wrap">
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

          {/* D. STUDENT INCONVENIENTES & MESSAGES SECTOR */}
          {activeSegment === 'inconvenientes' && (
            <div className="space-y-4">
              <div id="alumno-inconvenientes-form-container" className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Avisar Inconveniente Horario o Clase Especial</h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-400">Si un bloque predeterminado de tutoría/taller presenta tope académico con tus ramos de pregrado, envía un aviso formal para planificar una sesión de apoyo flexible individual.</p>
                  </div>
                </div>

                {formFeedback && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-150 dark:border-emerald-800 rounded-xl text-xs font-semibold animate-fade-in flex items-center space-x-1.5">
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
                        className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition-colors ${reqProgram === 'tutorias' ? 'bg-[#092c4c] dark:bg-brand-celeste text-white dark:text-[#092c4c] border-[#092c4c] dark:border-brand-celeste' : 'bg-white dark:bg-slate-800 text-slate-650 dark:text-slate-300 border-slate-205 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      >
                        Programa de Tutorías UFT
                      </button>
                      <button
                        type="button"
                        onClick={() => setReqProgram('psicoeducativo')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition-colors ${reqProgram === 'psicoeducativo' ? 'bg-[#3a9ad9] text-[#092c4c] border-[#3a9ad9]' : 'bg-white dark:bg-slate-800 text-slate-650 dark:text-slate-300 border-slate-205 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      >
                        Apoyo / Taller Psicoeducativo
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">Escribe tu Mensaje de Inconveniente</label>
                    <textarea
                      required
                      placeholder="Ej: Tengo tope con el horario de matemática los martes. Solicito realizar la tutoría en un horario alternativo individual debido a que asisto a laboratorio obligatorio."
                      value={reqMessage}
                      onChange={(e) => setReqMessage(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-[#3a9ad9] focus:outline-none h-20 resize-none font-medium bg-slate-50/50 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">Tus Horarios Propuestos (Flexibilidad)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Miércoles módulo 15:00 - 16:30 o Viernes 09:00 - 10:30"
                      value={reqPreferredTime}
                      onChange={(e) => setReqPreferredTime(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-[#3a9ad9] focus:outline-none font-medium bg-slate-50/50 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#092c4c] dark:bg-brand-celeste hover:bg-slate-900 dark:hover:bg-sky-400 text-white dark:text-[#092c4c] font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center space-x-2 shadow-xs"
                  >
                    <Send className="h-4 w-4 text-[#3a9ad9] dark:text-[#092c4c]" />
                    <span>Enviar Notificación al Docente</span>
                  </button>
                </form>
              </div>

              {/* Request log / Registro de clases individualizadas */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
                <h4 className="text-xs font-bold text-[#092c4c] dark:text-white uppercase tracking-wider">Tus Reportes de Coincidencias y Clases Programadas</h4>
                
                {myRequests.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-6">No has enviado avisos sobre inconvenientes.</p>
                ) : (
                  <div className="space-y-3">
                    {myRequests.map(r => {
                      const linkedSession = r.assignedSessionId 
                        ? sessions.find(s => s.id === r.assignedSessionId) 
                        : null;

                      return (
                        <div key={r.id} className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/20 dark:bg-slate-800/40 space-y-2">
                          <div className="flex justify-between items-start">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest ${r.program === 'tutorias' ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900'}`}>
                              {r.program === 'tutorias' ? 'Programa Tutorías' : 'Psicoeducativo'}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'resuelto' ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300' : 'bg-yellow-100 dark:bg-yellow-950/70 text-yellow-800 dark:text-yellow-300'}`}>
                              {r.status === 'resuelto' ? 'Clase Efectuada / Asignada' : 'Aviso Pendiente de Revisión'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 dark:text-slate-200 italic font-medium">"{r.message}"</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">Horario propuesto: <strong className="text-slate-600 dark:text-slate-300">{r.preferredTime}</strong></p>

                          {r.status === 'resuelto' && linkedSession && (
                            <div className="mt-2.5 pt-2.5 border-t border-dashed border-emerald-200 dark:border-emerald-800 bg-emerald-50/25 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800 space-y-1">
                              <span className="text-[9px] uppercase font-extrabold text-[#059669] dark:text-emerald-400 block">Registro Oficial Clase Efectuada / Coordinada:</span>
                              <h5 className="text-xs font-bold text-slate-800 dark:text-white">{linkedSession.title}</h5>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4">
                                <span>Fecha: <strong className="text-slate-700 dark:text-slate-200">{linkedSession.date}</strong></span>
                                <span>Módulo: <strong className="text-slate-700 dark:text-slate-200">{linkedSession.timeSlot}</strong></span>
                                <span>Espacio: <strong className="text-slate-700 dark:text-slate-200">{linkedSession.location}</strong></span>
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
        <footer className="h-10 bg-[#061e34] dark:bg-slate-950 border-t border-white/10 flex items-center justify-between px-6 md:px-8 text-[10px] text-slate-300 dark:text-slate-400 font-bold uppercase tracking-wider mt-auto shrink-0 select-none transition-colors">
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
      <NotificationModal
        isOpen={showNotifInbox}
        onClose={() => setShowNotifInbox(false)}
        userEmail={user.email}
        notifications={notifications}
        setNotifications={setNotifications}
        title="Bandeja de Mensajes y Comunicados"
        subtitle="Avisos oficiales y notificaciones del sistema institucional"
        senderLabel="Centro de Apoyo UFT"
      />

      {/* MODAL DE EVALUACIÓN DE SATISFACCIÓN (12 PREGUNTAS - RESPONSIVO & DARK MODE) */}
      {evaluatingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scale-up">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-[#092c4c] to-[#153a5c] text-white p-4 sm:p-5 relative shrink-0">
              <div className="flex items-center gap-3 pr-8">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold tracking-tight truncate">Encuesta de Hábitos y Satisfacción</h3>
                  <p className="text-[11px] sm:text-xs text-slate-300 truncate">Diagnóstico de hábitos de estudio y calidad académica (12 Ítems)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEvaluatingSession(null);
                  setRatingSuccessMsg(null);
                }}
                className="absolute top-4 right-4 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-all cursor-pointer"
                title="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario con Scroll Interno Suave */}
            <form onSubmit={handleSubmitRating} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 scrollbar-thin">
                {/* Información de la sesión evaluada */}
                <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 tracking-wider block">Sesión Evaluada:</span>
                      <h4 className="text-xs sm:text-sm font-bold text-[#092c4c] dark:text-white leading-snug break-words">{evaluatingSession.title}</h4>
                      <div className="flex flex-wrap gap-2 text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-0.5">
                        <span>📅 {evaluatingSession.date}</span>
                        <span>•</span>
                        <span>⏰ {evaluatingSession.timeSlot}</span>
                      </div>
                    </div>

                    {/* Promedio Calculado en Tiempo Real */}
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl px-3 py-1.5 text-center sm:text-right shrink-0 self-start sm:self-auto">
                      <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300 uppercase block">Promedio Calculado</span>
                      <div className="flex items-center justify-center sm:justify-end gap-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">
                          {(
                            SATISFACTION_SURVEY_QUESTIONS.reduce((acc, q) => acc + (surveyAnswers[q.id] || 5), 0) /
                            SATISFACTION_SURVEY_QUESTIONS.length
                          ).toFixed(1)} / 5.0
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {ratingSuccessMsg ? (
                  <div className="p-6 sm:p-8 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-center space-y-2.5 animate-fade-in my-6">
                    <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    <h4 className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-200">¡Evaluación Registrada con Éxito!</h4>
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{ratingSuccessMsg}</p>
                  </div>
                ) : (
                  <>
                    {/* Barra de Acciones Rápidas (Marcar todas con un clic) */}
                    <div className="bg-slate-100/80 dark:bg-slate-800/50 p-2.5 sm:p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#3a9ad9]" />
                        <span>Marcar todas con un clic:</span>
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {SURVEY_SCALE_OPTIONS.map((opt) => (
                          <button
                            key={opt.score}
                            type="button"
                            onClick={() => handleSetAllAnswers(opt.score)}
                            className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs"
                            title={`Marcar "${opt.label}" a todas las 12 preguntas`}
                          >
                            {opt.score}. {opt.shortLabel}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Acordeón / Cuadro de Instrucciones */}
                    <div className="bg-sky-50/70 dark:bg-sky-950/30 rounded-2xl border border-sky-200/80 dark:border-sky-900/60 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-sky-950 dark:text-sky-200 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-[#3a9ad9]" />
                          <span>Escala Oficial (Likert 1 a 5):</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowSurveyInstructions(prev => !prev)}
                          className="text-[10px] text-[#3a9ad9] hover:underline font-bold cursor-pointer"
                        >
                          {showSurveyInstructions ? 'Ocultar guía' : 'Ver guía detallada'}
                        </button>
                      </div>
                      
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {SATISFACTION_SURVEY_INSTRUCTIONS}
                      </p>

                      {showSurveyInstructions && (
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5 pt-1 animate-fade-in">
                          {SURVEY_SCALE_OPTIONS.map((opt) => (
                            <div key={opt.score} className="bg-white dark:bg-slate-800 px-2 py-1.5 rounded-lg border border-sky-100 dark:border-sky-950 text-[10px] shadow-2xs">
                              <p className="font-extrabold text-[#092c4c] dark:text-sky-300">{opt.label}</p>
                              <p className="text-slate-500 dark:text-slate-400 text-[9px] leading-tight mt-0.5">{opt.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Listado Responsivo de las 12 Preguntas */}
                    <div className="space-y-3">
                      {SATISFACTION_SURVEY_QUESTIONS.map((q) => {
                        const currentVal = surveyAnswers[q.id] || 5;
                        const currentOption = SURVEY_SCALE_OPTIONS.find(o => o.score === currentVal);

                        return (
                          <div
                            key={q.id}
                            className="bg-slate-50/90 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-3 sm:p-4 space-y-2.5 transition-all"
                          >
                            <div className="space-y-1">
                              <span className="inline-block text-[9.5px] font-extrabold uppercase px-2 py-0.5 bg-blue-100 dark:bg-sky-950/70 text-[#092c4c] dark:text-sky-300 rounded-md">
                                Ítem {q.id} • {q.title}
                              </span>
                              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                                {q.question}
                              </p>
                            </div>

                            {/* 5 Botones de selección adaptables a móviles y escritorio */}
                            <div className="grid grid-cols-5 gap-1 sm:gap-1.5 pt-0.5">
                              {SURVEY_SCALE_OPTIONS.map((opt) => {
                                const isSelected = currentVal === opt.score;
                                return (
                                  <button
                                    key={opt.score}
                                    type="button"
                                    onClick={() => handleSetAnswer(q.id, opt.score)}
                                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                                      isSelected
                                        ? 'bg-[#092c4c] dark:bg-[#3a9ad9] text-white dark:text-slate-900 border-[#092c4c] dark:border-[#3a9ad9] shadow-xs scale-[1.02]'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-[#3a9ad9] dark:hover:border-[#3a9ad9]'
                                    }`}
                                  >
                                    <span className="font-extrabold text-xs sm:text-[13px]">{opt.score}</span>
                                    <span className="text-[9px] sm:text-[10px] font-medium hidden xs:inline sm:inline truncate max-w-full">
                                      {opt.shortLabel}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Detalle explicativo de la opción seleccionada */}
                            <div className="text-[10.5px] sm:text-[11px] text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-500 dark:text-slate-400">Seleccionado:</span>
                              <span className="font-extrabold text-[#092c4c] dark:text-sky-300">
                                {currentOption?.label}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">•</span>
                              <span className="italic text-slate-600 dark:text-slate-300">
                                "{currentOption?.description}"
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Comentarios y Sugerencias */}
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Comentarios u observaciones adicionales sobre la sesión (Opcional):
                      </label>
                      <textarea
                        rows={2}
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Escribe observaciones sobre la tutoría o temas que te gustaría reforzar..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:border-[#3a9ad9] focus:ring-2 focus:ring-[#3a9ad9]/20 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Footer Fijo con Botones de Acción */}
              {!ratingSuccessMsg && (
                <div className="flex items-center justify-between gap-2.5 p-3.5 sm:p-5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEvaluatingSession(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRating}
                    className="px-5 py-2.5 rounded-xl bg-[#092c4c] dark:bg-[#3a9ad9] hover:bg-[#153a5c] dark:hover:bg-sky-400 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>{isSubmittingRating ? 'Guardando...' : 'Enviar Evaluación (12 Ítems)'}</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Barra de Navegación Inferior para Celulares / Mobile Responsive */}
      <nav 
        aria-label="Navegación móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#092c4c] dark:bg-slate-900 border-t border-[#153a5c] dark:border-slate-800 px-2 py-1.5 shadow-2xl flex items-center justify-around transform-gpu select-none"
        style={{ paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom))' }}
      >
        {/* 1. Tutorías */}
        <button
          type="button"
          onClick={() => {
            setActiveSegment('tutorias');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const mainElem = document.getElementById('student-main-panel-workspace');
            if (mainElem) mainElem.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer flex-1 ${
            activeSegment === 'tutorias'
              ? 'text-brand-celeste font-bold'
              : 'text-slate-400 hover:text-white font-medium'
          }`}
        >
          <Award className={`w-4 h-4 mb-0.5 ${activeSegment === 'tutorias' ? 'text-brand-celeste' : 'text-slate-400'}`} />
          <span className="text-[10px] leading-tight">Tutorías</span>
        </button>

        {/* 2. Talleres */}
        <button
          type="button"
          onClick={() => {
            setActiveSegment('psicoeducativo');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const mainElem = document.getElementById('student-main-panel-workspace');
            if (mainElem) mainElem.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer flex-1 ${
            activeSegment === 'psicoeducativo'
              ? 'text-brand-celeste font-bold'
              : 'text-slate-400 hover:text-white font-medium'
          }`}
        >
          <BookOpen className={`w-4 h-4 mb-0.5 ${activeSegment === 'psicoeducativo' ? 'text-brand-celeste' : 'text-slate-400'}`} />
          <span className="text-[10px] leading-tight">Talleres</span>
        </button>

        {/* 3. Escanear QR (Botón Central Destacado) */}
        <div id="alumno-mobile-qr-section" className="flex flex-col items-center justify-center -mt-5 px-1.5 z-50">
          <button
            type="button"
            onClick={() => setIsQRScannerOpen(true)}
            className="flex items-center justify-center w-12 h-12 rounded-full text-white bg-gradient-to-tr from-[#3a9ad9] via-[#0284c7] to-[#38bdf8] shadow-lg shadow-sky-500/30 border-[3px] border-[#092c4c] dark:border-slate-900 active:scale-90 transition-all cursor-pointer hover:brightness-110"
            title="Escanear Código QR de Asistencia"
          >
            <QrCode className="w-6 h-6 text-white" />
          </button>
          <span className="text-[9px] font-extrabold text-brand-celeste mt-0.5">QR</span>
        </div>

        {/* 4. Mis Reservas */}
        <button
          type="button"
          onClick={() => {
            setActiveSegment('my_bookings');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const mainElem = document.getElementById('student-main-panel-workspace');
            if (mainElem) mainElem.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer flex-1 relative ${
            activeSegment === 'my_bookings'
              ? 'text-brand-celeste font-bold'
              : 'text-slate-400 hover:text-white font-medium'
          }`}
        >
          <div className="relative">
            <Grid className={`w-4 h-4 mb-0.5 ${activeSegment === 'my_bookings' ? 'text-brand-celeste' : 'text-slate-400'}`} />
            {myActiveBookings.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-white rounded-full w-3.5 h-3.5 text-[8px] font-bold flex items-center justify-center">
                {myActiveBookings.length}
              </span>
            )}
          </div>
          <span className="text-[10px] leading-tight">Reservas</span>
        </button>

        {/* 5. Historial */}
        <button
          type="button"
          onClick={() => {
            setActiveSegment('history');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const mainElem = document.getElementById('student-main-panel-workspace');
            if (mainElem) mainElem.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer flex-1 ${
            activeSegment === 'history'
              ? 'text-brand-celeste font-bold'
              : 'text-slate-400 hover:text-white font-medium'
          }`}
        >
          <History className={`w-4 h-4 mb-0.5 ${activeSegment === 'history' ? 'text-brand-celeste' : 'text-slate-400'}`} />
          <span className="text-[10px] leading-tight">Historial</span>
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

      {/* Modal de Tutorial Interactivo Guiado */}
      <AlumnoTutorialModal
        isOpen={isTutorialOpen}
        onClose={handleCloseTutorial}
        userName={user.name}
        onNavigateTab={(tab) => {
          setActiveSegment(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          const mainElem = document.getElementById('student-main-panel-workspace');
          if (mainElem) mainElem.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
