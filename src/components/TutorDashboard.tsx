import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Session, IssueReport, UserAvailability, SessionFeedback, WebNotification } from '../types';
import { getSavedSessions, saveSessions, getSavedReports, saveReports, getSavedAvailabilities, saveAvailabilities, getSavedUsers, saveUsers, triggerNotification, TIME_SLOTS, getSavedNotifications, saveNotifications } from '../data';
import { getSocket } from '../services/socket';
import { 
  Calendar, 
  CheckSquare, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Users, 
  User as UserIcon, 
  LogOut, 
  CheckCircle,
  HelpCircle,
  Megaphone,
  Check,
  Mail,
  Edit3,
  Save,
  X,
  CheckCircle2,
  BookOpen,
  Award,
  QrCode,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Send,
  AlertCircle,
  FileText,
  Sparkles,
  GraduationCap,
  ClipboardCheck,
  MoreHorizontal,
  Filter,
  CheckCheck,
  Search,
  Star,
  MessageSquare,
  Bell
} from 'lucide-react';
import { SessionQRModal } from './common/SessionQRModal';
import { ThemeToggle } from './common/ThemeToggle';
import { NotificationModal } from './common/NotificationModal';
import { TutorAttendanceTab } from './tutor/TutorAttendanceTab';
import { TutorTutorialModal } from './tutor/TutorTutorialModal';
import { useNavigate } from 'react-router-dom';
import { useAuth, getRoleHomePath } from '../context/AuthContext';

interface TutorDashboardProps {
  user?: User;
  onLogout?: () => void;
  onUpdateUser?: (user: User) => void;
}

export type TutorTab = 'my_schedule' | 'attendance' | 'report_issue' | 'my_availability' | 'assigned_tutors' | 'compliance_review';

export default function TutorDashboard({ user: propUser, onLogout: propLogout, onUpdateUser: propUpdateUser }: TutorDashboardProps = {}) {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = propUser || auth.currentUser;
  const onLogout = propLogout || auth.logout;
  const onUpdateUser = propUpdateUser || auth.updateUser;

  if (!user) return null;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>(getSavedUsers());
  const [notifications, setNotifications] = useState<WebNotification[]>(() => {
    const local = getSavedNotifications();
    return user.email ? local.filter(n => n.toEmail?.toLowerCase() === user.email.toLowerCase()) : local;
  });
  const [showNotifInbox, setShowNotifInbox] = useState(false);

  // Usuario actualizado en tiempo real desde MongoDB y WebSockets
  const effectiveUser = useMemo(() => {
    const found = allUsers.find(u => u.id === user.id || u.rut === user.rut);
    if (found) {
      return {
        ...found,
        role: user.role || found.role,
        tutorType: user.tutorType || found.tutorType || 'tutor_par',
        tutorTypes: Array.isArray(user.tutorTypes) && user.tutorTypes.length > 0
          ? user.tutorTypes
          : (Array.isArray(found.tutorTypes) && found.tutorTypes.length > 0
            ? found.tutorTypes
            : (found.tutorType ? [found.tutorType] : ['tutor_par']))
      };
    }
    return user;
  }, [allUsers, user]);

  const isLeadTutor = effectiveUser.tutorType === 'tutor_de_tutores';
  
  // Dashboard tabs with persistence across reloads
  const [activeTab, setActiveTab] = useState<TutorTab>(() => {
    const saved = localStorage.getItem('uft_tutor_active_tab');
    if ((saved === 'assigned_tutors' || saved === 'compliance_review') && !isLeadTutor) return 'my_schedule';
    return (saved as TutorTab) || 'my_schedule';
  });

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('uft_tutor_active_tab', activeTab);
    }
  }, [activeTab]);

  // Lead Tutor expanded state & feedback
  const [expandedTutorId, setExpandedTutorId] = useState<string | null>(null);
  const [leadReminderFeedback, setLeadReminderFeedback] = useState<string | null>(null);

  // Compliance Review state
  const [complianceTutorFilter, setComplianceTutorFilter] = useState<string>('all');
  const [complianceStatusFilter, setComplianceStatusFilter] = useState<string>('all');
  const [complianceSearch, setComplianceSearch] = useState<string>('');
  const [openTutorMenuId, setOpenTutorMenuId] = useState<string | null>(null);
  const [expandedComplianceSessionIds, setExpandedComplianceSessionIds] = useState<Record<string, boolean>>({});

  const toggleComplianceSession = (sessionId: string) => {
    setExpandedComplianceSessionIds(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };
  
  // Issue Report form state
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [issueKind, setIssueKind] = useState<'reasignar_horario' | 'reasignar_tutor' | 'otro'>('reasignar_horario');
  const [proposedTime, setProposedTime] = useState('');
  const [suggestedTutorId, setSuggestedTutorId] = useState('');
  const [selectedDocenteIds, setSelectedDocenteIds] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);
  const [myAvailability, setMyAvailability] = useState<UserAvailability | null>(null);
  const [allAvailabilities, setAllAvailabilities] = useState<UserAvailability[]>(getSavedAvailabilities());
  const [activeQRModalSession, setActiveQRModalSession] = useState<Session | null>(null);
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false);
  // Evita que una recarga en segundo plano (disparada por cambios en OTRA pestaña, ej. el panel del docente)
  // sobrescriba bloques de disponibilidad que el tutor recién marcó y aún no ha guardado.
  const availabilityDirtyRef = useRef(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const scheduleSnapshotRef = useRef<UserAvailability | null>(null);

  // Tutorial Interactivo Guiado con Foco (Spotlight)
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      const storageKey = `uft_tutor_tutorial_shown_${user.id}_${isLeadTutor ? 'lead' : 'par'}`;
      const hasShown = localStorage.getItem(storageKey);
      if (!hasShown) {
        setIsTutorialOpen(true);
        localStorage.setItem(storageKey, 'true');
      }
    }
  }, [user?.id, isLeadTutor]);

  const handleOpenTutorial = () => {
    setIsTutorialOpen(true);
  };

  const handleCloseTutorial = () => {
    setIsTutorialOpen(false);
  };

  // Load database
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
    socket.on('reports:changed', handleRealtimeUpdate);
    socket.on('users:changed', handleRealtimeUpdate);
    socket.on('availabilities:changed', handleRealtimeUpdate);
    socket.on('notifications:changed', handleRealtimeUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      socket.off('sessions:changed', handleRealtimeUpdate);
      socket.off('reports:changed', handleRealtimeUpdate);
      socket.off('users:changed', handleRealtimeUpdate);
      socket.off('availabilities:changed', handleRealtimeUpdate);
      socket.off('notifications:changed', handleRealtimeUpdate);
    };
  }, [user]);

  const reloadData = async () => {
    setSessions(getSavedSessions());
    setReports(getSavedReports());

    // Cargar sesiones en tiempo real desde MongoDB Atlas
    try {
      const sRes = await fetch('/api/sessions');
      if (sRes.ok) {
        const sessionsFromApi = await sRes.json();
        if (Array.isArray(sessionsFromApi)) {
          setSessions(sessionsFromApi);
          saveSessions(sessionsFromApi);
        }
      }
    } catch (sErr) {
      // fallback local
    }

    // Cargar reportes en tiempo real desde MongoDB Atlas
    try {
      const repRes = await fetch('/api/reports');
      if (repRes.ok) {
        const reportsFromApi = await repRes.json();
        if (Array.isArray(reportsFromApi)) {
          setReports(reportsFromApi);
          saveReports(reportsFromApi);
        }
      }
    } catch (rErr) {
      // fallback local
    }

    // Cargar usuarios actualizados
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

    // Cargar notificaciones para el tutor
    if (user.email) {
      try {
        const notifRes = await fetch(`/api/notifications?email=${encodeURIComponent(user.email)}`);
        if (notifRes.ok) {
          const notifsFromApi = await notifRes.json();
          if (Array.isArray(notifsFromApi)) {
            const sorted = notifsFromApi.sort((a: WebNotification, b: WebNotification) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setNotifications(sorted);
            saveNotifications(sorted);
          }
        }
      } catch (nErr) {
        // fallback
      }
    }

    // Cargar disponibilidad desde MongoDB (tiene prioridad sobre localStorage)
    let list = getSavedAvailabilities();
    try {
      const avRes = await fetch('/api/availabilities');
      if (avRes.ok) {
        const avsFromApi = await avRes.json();
        if (Array.isArray(avsFromApi) && avsFromApi.length > 0) {
          const sanitizedAvs = avsFromApi.map((av: UserAvailability) => ({
            ...av,
            days: av.days.map(d => ({
              ...d,
              slots: (d.slots || []).filter(s => TIME_SLOTS.includes(s))
            }))
          }));
          const mongoUserIds = new Set(sanitizedAvs.map((a: any) => a.userId));
          const mergedAvs = [
            ...sanitizedAvs,
            ...list.filter(a => !mongoUserIds.has(a.userId))
          ];
          saveAvailabilities(mergedAvs);
          list = mergedAvs;
        }
      }
    } catch (e) {
      // fallback a localStorage
    }
    setAllAvailabilities(list);

    let found = list.find(a => a.userId === user.id && a.role === 'tutor');
    const ALL_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    
    if (!found) {
      found = {
        userId: user.id,
        role: 'tutor',
        userName: user.name,
        career: user.career || 'Tutor Par',
        days: ALL_DAYS.map(day => ({ day, slots: [] })),
        updatedAt: new Date().toISOString()
      };
    } else {
      // Ensure all days from Lunes to Domingo are present
      const existingDayMap = new Map(found.days.map(d => [d.day, d.slots]));
      found = {
        ...found,
        days: ALL_DAYS.map(day => ({
          day,
          slots: existingDayMap.get(day) || []
        }))
      };
    }
    if (!availabilityDirtyRef.current) {
      setMyAvailability(found);
    }
  };

  // Tutor's personal assigned tutoring list
  const myAssignedSessions = sessions.filter(s => s.tutorId === user.id);

  // Tutores a cargo si el usuario es Tutor de Tutores (sincronizados reactivamente con WebSockets / MongoDB)
  const assignedTutors = useMemo(() => {
    return allUsers.filter(u => u && (u.role === 'tutor' || (Array.isArray(u.roles) && u.roles.includes('tutor'))) && (effectiveUser.assignedTutorIds || []).includes(u.id));
  }, [allUsers, effectiveUser.assignedTutorIds]);

  // Helper para determinar el estado de cumplimiento de una tutoría
  const getSessionComplianceStatus = (session: Session) => {
    const hasSyllabus = Boolean(session.syllabus && session.syllabus.trim().length > 0);
    const registeredCount = (session.studentIds || []).length;
    
    // Si hay un reporte de incidencia pendiente para la sesión -> Inconsistente
    const hasIncident = reports.some(r => r.sessionId === session.id && r.status === 'pendiente');
    if (hasIncident) {
      return {
        status: 'inconsistente' as const,
        label: 'Inconsistente',
        badgeBg: 'bg-[#ffe4e6] text-[#be123c] border border-[#fecdd3]',
        description: 'Alerta / Inconveniente reportado pendiente de resolver'
      };
    }

    const attendances = session.attendance || {};
    let presentCount = 0;
    let absentCount = 0;
    let pendingAttendanceCount = 0;

    (session.studentIds || []).forEach(stId => {
      const st = attendances[stId] || 'pendiente';
      if (st === 'presente') presentCount++;
      else if (st === 'ausente') absentCount++;
      else pendingAttendanceCount++;
    });

    // Si le falta el temario / cronograma
    if (!hasSyllabus) {
      return {
        status: 'sin_cronograma' as const,
        label: 'Sin cronograma',
        badgeBg: 'bg-[#fef3c7] text-[#b45309] border border-[#fde68a]',
        description: 'Tutor no ha registrado el temario de la sesión'
      };
    }

    // Si tiene cronograma y la asistencia ya se tomó completa
    if (registeredCount > 0 && pendingAttendanceCount === 0 && (presentCount > 0 || absentCount > 0)) {
      return {
        status: 'cumplida' as const,
        label: 'Cumplida',
        badgeBg: 'bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]',
        description: 'Cronograma cargado y asistencia de estudiantes registrada'
      };
    }

    // Si la fecha ya pasó y aún hay alumnos con asistencia pendiente
    const todayStr = new Date().toISOString().split('T')[0];
    if (session.date < todayStr && (registeredCount === 0 || pendingAttendanceCount > 0)) {
      return {
        status: 'inconsistente' as const,
        label: 'Inconsistente',
        badgeBg: 'bg-[#ffe4e6] text-[#be123c] border border-[#fecdd3]',
        description: 'Sesión pasada sin registro de asistencia completado'
      };
    }

    // Sesión programada / pendiente
    return {
      status: 'pendiente' as const,
      label: 'Pendiente',
      badgeBg: 'bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]',
      description: 'Sesión programada próxima a ejecutarse'
    };
  };

  // Enviar recordatorio directo al tutor por correo y notificación
  const handleSendTutorReminder = (targetTutor: User, reminderTopic: 'cronograma' | 'asistencia' | 'general') => {
    const topicLabel = reminderTopic === 'cronograma'
      ? 'Carga de Cronogramas / Temarios'
      : reminderTopic === 'asistencia'
      ? 'Registro y Cierre de Asistencias'
      : 'Seguimiento de Tutorías y Asistencias';

    const subject = `[Recordatorio de Coordinación] ${topicLabel} - Trayectoria UFT`;
    const message = `Tu Tutor Coordinador (${effectiveUser.name}) ha revisado tus tutorías asignadas y te solicita actualizar los registros pendientes (${topicLabel}). Por favor ingresa a tu portal para registrar la información correspondiente.`;

    triggerNotification(
      targetTutor.email,
      targetTutor.name,
      subject,
      message
    );

    setLeadReminderFeedback(`¡Recordatorio enviado exitosamente a ${targetTutor.name}!`);
    setTimeout(() => setLeadReminderFeedback(null), 4500);
  };

  // Enviar recordatorio para una tutoría puntual
  const handleSendSessionSpecificReminder = (targetTutor: User, targetSession: Session, reason: string) => {
    const subject = `[Revisión de Cumplimiento] Tutoría "${targetSession.title}" - Trayectoria UFT`;
    const message = `Tu Tutor Coordinador (${effectiveUser.name}) ha revisado el cumplimiento de tu tutoría "${targetSession.title}" del día ${targetSession.date} y solicita tu atención: ${reason}. Por favor ingresa a tu portal para revisar y completar la información.`;

    triggerNotification(
      targetTutor.email,
      targetTutor.name,
      subject,
      message
    );

    setLeadReminderFeedback(`¡Recordatorio de sesión enviado a ${targetTutor.name}!`);
    setTimeout(() => setLeadReminderFeedback(null), 4500);
  };

  // Cronograma / Temario State for Sessions
  const [editingSyllabusSessionId, setEditingSyllabusSessionId] = useState<string | null>(null);
  const [syllabusText, setSyllabusText] = useState<string>('');
  const [syllabusFeedback, setSyllabusFeedback] = useState<string | null>(null);

  // Handle saving syllabus for a session
  const handleSaveSyllabus = async (sessionId: string) => {
    const current = getSavedSessions();
    let updatedTargetSession: Session | null = null;
    const updated = current.map(s => {
      if (s.id === sessionId) {
        updatedTargetSession = {
          ...s,
          syllabus: syllabusText.trim()
        };
        return updatedTargetSession;
      }
      return s;
    });

    saveSessions(updated);
    setSessions(updated);
    setEditingSyllabusSessionId(null);
    setSyllabusFeedback('¡Cronograma y plan de trabajo actualizado con éxito! Ahora es visible para los estudiantes y docentes.');
    setTimeout(() => setSyllabusFeedback(null), 4000);

    if (updatedTargetSession) {
      try {
        await fetch(`/api/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTargetSession)
        });
      } catch (err) {
        console.warn('Sync syllabus to backend:', err);
      }
    }
  };

  // Quick Attendance tracking inside Tutor view
  const handleTutorAttendance = (sessionId: string, studentId: string, status: 'presente' | 'ausente') => {
    const current = getSavedSessions();
    let newStatus: 'presente' | 'ausente' | 'pendiente' = status;
    let targetSessionObj: Session | null = null;

    const updated: Session[] = current.map(s => {
      if (s.id === sessionId) {
        const currentAtt = s.attendance || {};
        newStatus = (currentAtt[studentId] === status ? 'pendiente' : status) as 'presente' | 'ausente' | 'pendiente';
        const updatedSess: Session = {
          ...s,
          attendance: {
            ...currentAtt,
            [studentId]: newStatus
          },
          isCompleted: true
        };
        targetSessionObj = updatedSess;
        return updatedSess;
      }
      return s;
    });

    saveSessions(updated);
    setSessions(updated);

    if (targetSessionObj) {
      // Sincronizar en backend / MongoDB
      fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetSessionObj)
      }).catch(err => console.warn('Error sync attendance a Mongo:', err));

      const student = allUsers.find(u => u.id === studentId);
      if (student && student.email) {
        if (newStatus === 'presente') {
          triggerNotification(
            student.email,
            student.name,
            `Encuesta de Satisfacción: "${(targetSessionObj as Session).title}"`,
            `Tu tutoría "${(targetSessionObj as Session).title}" del día ${(targetSessionObj as Session).date} ha finalizado. Por favor ingresa a la plataforma en tu Historial de Clases para responder la encuesta de satisfacción de 12 preguntas y evaluar tu experiencia.`
          );
        } else if (newStatus === 'ausente') {
          triggerNotification(
            student.email,
            student.name,
            `Aviso de Inasistencia: "${(targetSessionObj as Session).title}"`,
            `Registramos tu inasistencia en la sesión de tutoría "${(targetSessionObj as Session).title}" del día ${(targetSessionObj as Session).date}. Ingresa a la plataforma para revisar los detalles.`
          );
        }
      }
    }
  };

  // Otros tutores disponibles para suplir / sustituir (excluyendo al tutor actual)
  const otherTutores = useMemo(() => {
    return allUsers.filter(u => 
      u && 
      u.id !== user.id && 
      (u.role === 'tutor' || (Array.isArray(u.roles) && u.roles.includes('tutor')))
    );
  }, [allUsers, user.id]);

  // Docentes coordinadores disponibles en la plataforma
  const allDocentes = useMemo(() => {
    return allUsers.filter(u => u && (u.role === 'docente' || (Array.isArray(u.roles) && u.roles.includes('docente'))) && u.email);
  }, [allUsers]);

  // Inicializar todos los docentes marcados por defecto
  useEffect(() => {
    if (allDocentes.length > 0 && selectedDocenteIds.length === 0) {
      setSelectedDocenteIds(allDocentes.map(d => d.id));
    }
  }, [allDocentes]);

  // Sesión actualmente seleccionada en el formulario de aviso de inconvenientes
  const selectedSessionForIssue = useMemo(() => {
    return sessions.find(s => s.id === selectedSessionId) || null;
  }, [sessions, selectedSessionId]);

  // Submit re-routing or re-scheduling ticket to coordinator
  const handleSendReport = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    if (!selectedSessionId) {
      setFormFeedback('Por favor, selecciona cuál tutoría presenta el inconveniente.');
      return;
    }

    if (!description.trim()) {
      setFormFeedback('Por favor, ingresa una descripción para que el Docente pueda asistirte.');
      return;
    }

    const targetDocentes = allDocentes.filter(d => selectedDocenteIds.includes(d.id));
    if (targetDocentes.length === 0) {
      setFormFeedback('Por favor, selecciona al menos un docente destinatario para enviar la alerta.');
      return;
    }

    const currentReports = getSavedReports();
    const suggestedTutorObj = suggestedTutorId ? otherTutores.find(t => t.id === suggestedTutorId) : undefined;

    const newReport: IssueReport = {
      id: `report_${Date.now()}`,
      sessionId: selectedSessionId,
      tutorId: user.id,
      description: description,
      requestType: issueKind,
      proposedTime: proposedTime ? proposedTime : undefined,
      suggestedTutorId: suggestedTutorId ? suggestedTutorId : undefined,
      suggestedTutorName: suggestedTutorObj ? suggestedTutorObj.name : undefined,
      status: 'pendiente',
      createdAt: new Date().toISOString()
    };

    const updated = [...currentReports, newReport];
    saveReports(updated);
    setReports(updated);

    // Sincronizar en MongoDB Atlas
    fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReport)
    }).catch(err => console.warn('Sync report en Mongo:', err));

    // Obtener información de la sesión afectada
    const targetSession = sessions.find(s => s.id === selectedSessionId);
    const sessionTitle = targetSession ? targetSession.title : 'Tutoría Asignada';
    const sessionDetails = targetSession ? `${targetSession.date} a las ${targetSession.timeSlot} (${targetSession.location})` : 'Sesión activa';

    // 1. Notificar al Tutor confirmando la recepción del aviso
    triggerNotification(
      user.email,
      user.name,
      `Aviso de Inconveniente Registrado: ${sessionTitle}`,
      `Hola ${user.name},\n\nHemos recibido tu reporte sobre la tutoría "${sessionTitle}".\n\n• Motivo: ${issueKind === 'reasignar_horario' ? 'Cambio de Horario' : issueKind === 'reasignar_tutor' ? 'Reasignación de Tutor' : 'Otro Inconveniente'}\n• Detalle: "${description}"\n${proposedTime ? `• Horario alternativo propuesto: ${proposedTime}\n` : ''}${suggestedTutorObj ? `• Tutor sugerido para suplir: ${suggestedTutorObj.name} (${suggestedTutorObj.career || 'Tutor Par'})\n` : ''}\nLa coordinación docente revisará tu caso a la brevedad.`
    );

    // 2. Notificar por correo a los Docentes Coordinadores SELECCIONADOS
    const kindLabel = issueKind === 'reasignar_horario' ? 'Reasignación / Cambio de Horario' : issueKind === 'reasignar_tutor' ? 'Reasignación de Tutor de Apoyo' : 'Inconveniente Operativo';
    const subjectDocente = `[Alerta de Tutor] Inconveniente en Tutoría: ${user.name} - ${sessionTitle}`;
    const originUrl = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:3000';
    const portalDocenteUrl = `${originUrl}/docente`;

    targetDocentes.forEach(docente => {
      const htmlBody = `
        <div style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
          <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(9, 44, 76, 0.06);">
            
            <!-- Header simple institucional -->
            <div style="background-color: #092c4c; padding: 18px 24px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 700;">Trayectoria UFT</h1>
              <span style="display: block; margin-top: 2px; color: #3a9ad9; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Aviso de Inconveniente • Tutoría Par</span>
            </div>

            <!-- Contenido Minimalista -->
            <div style="padding: 24px;">
              <h2 style="margin: 0 0 10px; color: #092c4c; font-size: 15px; font-weight: 700;">Hola, ${docente.name}</h2>
              <p style="margin: 0 0 16px; color: #475569; font-size: 13.5px; line-height: 1.55;">
                El tutor <strong>${user.name}</strong> (${user.career || 'Tutor Par'}) ha informado un inconveniente operativo para la tutoría asignada:
              </p>

              <!-- Tarjeta Resumen -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; font-size: 12.5px; line-height: 1.6; color: #334155;">
                <p style="margin: 3px 0;">📚 <strong>Tutoría Afectada:</strong> ${sessionTitle}</p>
                <p style="margin: 3px 0;">📅 <strong>Fecha y Horario:</strong> ${sessionDetails}</p>
                <p style="margin: 3px 0;">🏷️ <strong>Tipo de Solicitud:</strong> <span style="color: #092c4c; font-weight: 700;">${kindLabel}</span></p>
                ${proposedTime ? `<p style="margin: 3px 0;">⏰ <strong>Horario propuesto:</strong> <span style="color: #0284c7; font-weight: 700;">${proposedTime}</span></p>` : ''}
                ${suggestedTutorObj ? `<p style="margin: 3px 0;">🧑‍🏫 <strong>Tutor sugerido para suplir:</strong> <span style="color: #0d9488; font-weight: 700;">${suggestedTutorObj.name} (${suggestedTutorObj.career || 'Tutor Par'})</span></p>` : ''}
              </div>

              <!-- Motivo -->
              <div style="background-color: #f1f5f9; border-left: 3px solid #3a9ad9; border-radius: 6px; padding: 10px 14px; margin-bottom: 22px; font-size: 12.5px; color: #334155; font-style: italic; line-height: 1.5;">
                "${description}"
              </div>

              <!-- Botón directo a la plataforma -->
              <div style="text-align: center; margin: 24px 0 16px;">
                <a href="${portalDocenteUrl}" target="_blank" style="display: inline-block; background-color: #092c4c; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 10px; box-shadow: 0 2px 6px rgba(9, 44, 76, 0.25);">
                  Ver y Gestionar en Portal Docente &rarr;
                </a>
              </div>

              <p style="margin: 16px 0 0; font-size: 11.5px; color: #64748b; line-height: 1.4; text-align: center;">
                Toda la información y opciones de reasignación se encuentran disponibles directamente en el portal docente.
              </p>
            </div>

            <!-- Footer minimal -->
            <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 12px 24px; text-align: center;">
              <span style="font-size: 11px; color: #94a3b8;">Universidad Finis Terrae • Dirección de Trayectoria Estudiantil</span>
            </div>
          </div>
        </div>
      `;

      const plainText = `Hola ${docente.name},\n\nEl tutor ${user.name} ha reportado un inconveniente (${kindLabel}) para la sesión "${sessionTitle}" (${sessionDetails}).\n\nMotivo: "${description}"\n${suggestedTutorObj ? `Tutor sugerido para suplir: ${suggestedTutorObj.name}\n` : ''}\nPuedes gestionar este caso directamente en el Portal Docente:\n${portalDocenteUrl}`;

      triggerNotification(
        docente.email,
        docente.name,
        subjectDocente,
        plainText,
        htmlBody
      );
    });

    setFormFeedback(`¡Inconveniente enviado con éxito! Se ha notificado por correo a ${targetDocentes.length} docente(s) coordinador(es) ${suggestedTutorObj ? `con la sugerencia de ${suggestedTutorObj.name} para suplir la sesión` : ''} y se envió un comprobante a tu correo institucional.`);
    setDescription('');
    setProposedTime('');
    setSuggestedTutorId('');
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-200" id="tutor-dashboard-wrapper">
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
                <span className="text-sm font-black tracking-tight leading-none text-white flex items-center gap-1.5">
                  Trayectoria <span className="text-[#3a9ad9]">UFT</span>
                  {isLeadTutor && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                      <ShieldCheck className="w-3 h-3 text-indigo-300" />
                      Coord. Pares
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-300 dark:text-slate-400 font-medium">
                  {isLeadTutor ? 'Portal Tutor de Tutores' : 'Portal Tutor Par'}
                </span>
              </div>
            </div>

            {/* Navegación Superior Horizontal Principal */}
            <nav id="tutor-desktop-nav-bar" className="hidden md:flex items-center gap-1.5 lg:gap-2 overflow-x-auto py-1 scrollbar-none">
              <button
                type="button"
                onClick={() => { setActiveTab('my_schedule'); reloadData(); }}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'my_schedule'
                    ? 'bg-[#3a9ad9] text-[#092c4c] shadow-sm font-black'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Calendar className="h-4 w-4 lg:h-4.5 lg:w-4.5 shrink-0" />
                <span>Mis Tutorías</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('attendance'); reloadData(); }}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'attendance'
                    ? 'bg-[#3a9ad9] text-[#092c4c] shadow-sm font-black'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <CheckSquare className="h-4 w-4 lg:h-4.5 lg:w-4.5 shrink-0" />
                <span>Pasar Lista</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('my_availability'); reloadData(); }}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'my_availability'
                    ? 'bg-[#3a9ad9] text-[#092c4c] shadow-sm font-black'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Clock className="h-4 w-4 lg:h-4.5 lg:w-4.5 shrink-0" />
                <span>Cargar Horario</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('report_issue'); reloadData(); }}
                className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'report_issue'
                    ? 'bg-[#3a9ad9] text-[#092c4c] shadow-sm font-black'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <AlertTriangle className="h-4 w-4 lg:h-4.5 lg:w-4.5 text-amber-300 shrink-0" />
                <span>Avisar Inconveniente</span>
              </button>

              {isLeadTutor && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('assigned_tutors'); reloadData(); }}
                  className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'assigned_tutors'
                      ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm ring-1 ring-indigo-300 font-black'
                      : 'text-indigo-200 hover:bg-indigo-500/20 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 lg:h-4.5 lg:w-4.5 text-indigo-300 shrink-0" />
                  <span>Tutores a Cargo</span>
                  {assignedTutors.length > 0 && (
                    <span className={`px-1.5 lg:px-2 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      activeTab === 'assigned_tutors' ? 'bg-white/20 text-white' : 'bg-indigo-400 text-white'
                    }`}>
                      {assignedTutors.length}
                    </span>
                  )}
                </button>
              )}

              {isLeadTutor && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('compliance_review'); reloadData(); }}
                  className={`flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 rounded-xl text-[13px] lg:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'compliance_review'
                      ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm ring-1 ring-indigo-300 font-black'
                      : 'text-indigo-200 hover:bg-indigo-500/20 hover:text-white'
                  }`}
                >
                  <ClipboardCheck className="h-4 w-4 lg:h-4.5 lg:w-4.5 text-indigo-300 shrink-0" />
                  <span>Revisión Cumplimiento</span>
                </button>
              )}
            </nav>

            {/* Acciones Derecha (Bandeja, ThemeToggle, Perfil del Tutor & Logout) */}
            <div id="tutor-header-actions-group" className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowNotifInbox(true)}
                className={`relative p-2 rounded-xl transition-all cursor-pointer ${
                  showNotifInbox
                    ? 'bg-[#3a9ad9] text-[#092c4c]'
                    : 'bg-white/10 hover:bg-white/20 text-slate-200'
                }`}
                title="Bandeja de Mensajes y Comunicados"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#e28743] text-white px-1.5 py-0.2 rounded-full text-[9px] font-extrabold border-2 border-[#092c4c]">
                    {notifications.filter(n => !n.read).length}
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
                id="tutor-tutorial-replay-btn"
              >
                <span className="text-sm font-black leading-none font-mono">!</span>
              </button>

              {/* Perfil del Tutor con Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition cursor-pointer border border-white/10"
                >
                  <UserIcon className="h-3.5 w-3.5 text-[#3a9ad9]" />
                  <span className="max-w-[120px] truncate hidden sm:inline">{effectiveUser.name}</span>
                  <ChevronDown className="h-3 w-3 text-slate-300" />
                </button>

                {showLogoutDropdown && (
                  <div className="bg-[#0a0a0a] border border-white/15 rounded-xl p-3 space-y-2.5 animate-fade-in text-xs absolute right-0 z-50 shadow-2xl top-[110%] w-60">
                    <div className="pb-2 border-b border-white/10 text-[11px] text-slate-300 space-y-0.5">
                      <p className="font-extrabold text-white truncate">{effectiveUser.name}</p>
                      <p className="text-[10px] text-[#3a9ad9] truncate">{isLeadTutor ? 'Tutor de Tutores' : effectiveUser.career || 'Tutor Par'}</p>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5">RUT: {effectiveUser.rut}</p>
                    </div>

                    {(() => {
                      const userTutorTypes = Array.isArray(effectiveUser.tutorTypes) && effectiveUser.tutorTypes.length > 0
                        ? effectiveUser.tutorTypes
                        : [effectiveUser.tutorType || 'tutor_par'];
                      const hasBothTutorSubroles = userTutorTypes.includes('tutor_par') && userTutorTypes.includes('tutor_de_tutores');
                      const otherRoles = Array.isArray(effectiveUser.roles) ? effectiveUser.roles.filter(r => r !== 'tutor') : [];

                      if (otherRoles.length === 0 && !hasBothTutorSubroles) return null;

                      return (
                        <div className="pb-2 border-b border-white/10 space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cambiar de Portal</p>
                          <div className="space-y-1">
                            {/* Alternar entre Tutor Par y Tutor de Tutores si tiene ambos */}
                            {hasBothTutorSubroles && (
                              isLeadTutor ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowLogoutDropdown(false);
                                    const updated = { ...effectiveUser, role: 'tutor' as const, tutorType: 'tutor_par' as const };
                                    auth.login(updated);
                                    auth.updateUser(updated);
                                    setActiveTab('my_schedule');
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white transition flex items-center justify-between text-[11px] font-semibold cursor-pointer border border-emerald-500/30"
                                >
                                  <span>🧑‍🏫 Portal Tutor Par</span>
                                  <span className="text-[10px] text-emerald-400 font-bold">&rarr;</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowLogoutDropdown(false);
                                    const updated = { ...effectiveUser, role: 'tutor' as const, tutorType: 'tutor_de_tutores' as const };
                                    auth.login(updated);
                                    auth.updateUser(updated);
                                    setActiveTab('assigned_tutors');
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-white transition flex items-center justify-between text-[11px] font-semibold cursor-pointer border border-indigo-500/30"
                                >
                                  <span>🛡️ Portal Tutor de Tutores</span>
                                  <span className="text-[10px] text-indigo-400 font-bold">&rarr;</span>
                                </button>
                              )
                            )}

                            {/* Otros roles principales */}
                            {otherRoles.map(r => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  setShowLogoutDropdown(false);
                                  auth.login({ ...effectiveUser, role: r });
                                  navigate(getRoleHomePath(r));
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white transition flex items-center justify-between text-[11px] font-semibold cursor-pointer"
                              >
                                <span>{r === 'alumno' ? '🎓 Portal Estudiante' : r === 'docente' ? '👨‍🏫 Portal Docente' : '🛡️ Panel Administrador'}</span>
                                <span className="text-[10px] text-[#3a9ad9] font-bold">Ir &rarr;</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

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

        {/* Barra de Pestañas Móviles (Scroll horizontal para celulares) */}
        <div className="md:hidden border-t border-[#153a5c] dark:border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-[#07223b] dark:bg-slate-900/90">
          <button
            onClick={() => { setActiveTab('my_schedule'); reloadData(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap ${activeTab === 'my_schedule' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-white/10 text-white'}`}
          >
            Mis Tutorías
          </button>
          <button
            onClick={() => { setActiveTab('attendance'); reloadData(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap ${activeTab === 'attendance' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-white/10 text-white'}`}
          >
            Pasar Lista
          </button>
          <button
            onClick={() => { setActiveTab('my_availability'); reloadData(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap ${activeTab === 'my_availability' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-white/10 text-white'}`}
          >
            Cargar Horario
          </button>
          <button
            onClick={() => { setActiveTab('report_issue'); reloadData(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap ${activeTab === 'report_issue' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-white/10 text-white'}`}
          >
            Inconvenientes
          </button>
          {isLeadTutor && (
            <>
              <button
                onClick={() => { setActiveTab('assigned_tutors'); reloadData(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap flex items-center gap-1 ${activeTab === 'assigned_tutors' ? 'bg-indigo-600 text-white' : 'bg-indigo-950 text-indigo-200 border border-indigo-700/50'}`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Tutores ({assignedTutors.length})</span>
              </button>
              <button
                onClick={() => { setActiveTab('compliance_review'); reloadData(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 whitespace-nowrap flex items-center gap-1 ${activeTab === 'compliance_review' ? 'bg-indigo-600 text-white' : 'bg-indigo-950 text-indigo-200 border border-indigo-700/50'}`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Cumplimiento</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace Column */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-200" id="tutor-main-panel-workspace">

        {/* Content Section Wrapper */}
        <div className="flex-1 p-6 md:p-8" id="tutor-main-dynamic-card-viewport">
          
          {/* My Assigned appointments tab */}
          {activeTab === 'my_schedule' && (
            <div id="tutor-my-schedule-view" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 font-display">Tus Actividades Diarias de Tutoría</h3>
                <p className="text-xs text-slate-500">Visualiza las tutorías donde te han definido como tutor a disposición de un alumno.</p>
              </div>

              {myAssignedSessions.length === 0 ? (
                <div className="bg-slate-50 p-12 rounded-xl text-center border-2 border-dashed border-slate-200">
                  <Calendar className="mx-auto h-10 w-10 text-slate-300" />
                  <h4 className="font-bold text-slate-700 mt-3 text-sm">No tienes tutorías programadas</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    La coordinadora (Docente Alison u otra) te asignará alumnos que muestren dificultades o inasistencias en los módulos generales.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myAssignedSessions.map((s) => {
                    const coordinator = allUsers.find(u => u.id === s.docenteId);

                    return (
                      <div 
                        key={s.id} 
                        className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-brand-celeste/70 transition-all space-y-4"
                      >
                        <div className="flex justify-between items-start">
                          <span className={`font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                            s.type === 'tutoria_general'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : s.type === 'psico_taller' || s.type === 'psico_asesoria_individual'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-sky-50 text-sky-800 border-sky-200'
                          }`}>
                            {s.type === 'tutoria_general' ? 'Tutoría Grupal' : s.type === 'psico_taller' ? 'Taller Psicoeducativo' : s.type === 'psico_asesoria_individual' ? 'Asesoría Psicoeducativa' : 'Tutoría Personalizada'}
                          </span>
                          <span className="text-xs font-mono font-bold text-brand-navy bg-slate-50 px-2 py-1 rounded flex items-center space-x-1">
                            <Clock className="h-3 w-3 inline text-brand-celeste hover:animate-pulse" />
                            <span>{s.date} • {s.timeSlot}</span>
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-slate-800 leading-snug">{s.title}</h4>
                          <div className="mt-2 space-y-1 text-xs text-slate-500">
                            <p className="flex items-center space-x-1.5ClassName">
                              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 inline mr-1" />
                              <span>Ubicación: <strong>{s.location}</strong></span>
                            </p>
                            <p className="flex items-center space-x-1.5">
                              <Users className="h-3.5 w-3.5 text-slate-400 shrink-0 inline mr-1" />
                              <span>Coordinador Responsable: <strong>{coordinator?.name || 'Coordinación Académica UFT'}</strong></span>
                            </p>
                          </div>
                        </div>

                        {/* Cronograma / Temario / Plan de Trabajo del Tutor */}
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/80 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center space-x-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                              <span>Cronograma y Plan de la Tutoría</span>
                            </h5>
                            {editingSyllabusSessionId !== s.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSyllabusSessionId(s.id);
                                  setSyllabusText(s.syllabus || '');
                                }}
                                className="text-[10px] text-indigo-600 hover:text-indigo-900 font-bold hover:underline cursor-pointer flex items-center gap-1"
                              >
                                ✏️ {s.syllabus ? 'Editar Cronograma' : '+ Asignar Cronograma'}
                              </button>
                            )}
                          </div>

                          {editingSyllabusSessionId === s.id ? (
                            <div className="space-y-2 animate-fade-in">
                              <textarea
                                value={syllabusText}
                                onChange={(e) => setSyllabusText(e.target.value)}
                                rows={3}
                                placeholder="Escribe el cronograma o temas de la sesión (ej. 1. Repaso de conceptos clave, 2. Ejercicios prácticos de guías, 3. Resolución de dudas de prueba...)"
                                className="w-full text-xs p-2.5 bg-white border border-indigo-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingSyllabusSessionId(null)}
                                  className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-50 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveSyllabus(s.id)}
                                  className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 cursor-pointer shadow-xs"
                                >
                                  Guardar y Publicar Cronograma
                                </button>
                              </div>
                            </div>
                          ) : s.syllabus ? (
                            <div className="bg-white/80 p-2.5 rounded-lg border border-indigo-100 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                              {s.syllabus}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">
                              Aún no has asignado un cronograma temático para esta tutoría. Haz clic en <strong>+ Asignar Cronograma</strong> para informar a los alumnos y docentes qué se trabajará.
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5 font-medium text-slate-600">
                            <Users className="h-3.5 w-3.5 text-[#3a9ad9]" />
                            <span>Inscritos: <strong>{s.studentIds?.length || 0} / {s.maxSpots}</strong> estudiantes</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('attendance')}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-[#092c4c] hover:text-white text-[#092c4c] text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="Ir a Pasar Lista para marcar asistencia o proyectar QR"
                          >
                            <CheckSquare className="w-3 h-3 text-[#3a9ad9]" />
                            <span>Pasar Lista &rarr;</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: PASAR LISTA Y REGISTRO DE ASISTENCIA (AMBOS SUBROLES) */}
          {activeTab === 'attendance' && (
            <TutorAttendanceTab
              user={user}
              effectiveUser={effectiveUser}
              isLeadTutor={isLeadTutor}
              sessions={sessions}
              setSessions={setSessions}
              allUsers={allUsers}
              assignedTutors={assignedTutors}
              onReload={reloadData}
              onOpenQRModal={(sess) => setActiveQRModalSession(sess)}
            />
          )}

          {/* TAB 2: FLAG PROBLEM / REASSIGNMENT TICKET */}
          {activeTab === 'report_issue' && (
            <div id="tutor-report-issue-view" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 font-display">Avisar Inconveniente o Solicitar Reasignaciones</h3>
                <p className="text-xs text-slate-500">¿Tienes un contratiempo? Infórmalo aquí. El docente de coordinación responderá de inmediato.</p>
              </div>

              {formFeedback && (
                <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-xs font-semibold animate-fade-in flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{formFeedback}</span>
                </div>
              )}

              <form onSubmit={handleSendReport} className="space-y-4">
                
                {/* 1. Pick appointment */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">¿A cuál de tus clases asignadas se refiere?</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs rounded-lg text-slate-700"
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                  >
                    <option value="">-- Elige una de tus Tutorías --</option>
                    {myAssignedSessions.map(s => (
                      <option key={s.id} value={s.id}>
                        [{s.date} • {s.timeSlot}] {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Issue nature */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Naturaleza de la Alerta</label>
                    <div className="flex flex-col space-y-2">
                      <label className="flex items-center space-x-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100">
                        <input
                          type="radio"
                          name="issueKind"
                          checked={issueKind === 'reasignar_horario'}
                          onChange={() => setIssueKind('reasignar_horario')}
                          className="text-brand-navy"
                        />
                        <span>No puedo asistir / Solicito cambiar horario de cita</span>
                      </label>

                      <label className="flex items-center space-x-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100">
                        <input
                          type="radio"
                          name="issueKind"
                          checked={issueKind === 'reasignar_tutor'}
                          onChange={() => setIssueKind('reasignar_tutor')}
                          className="text-brand-navy"
                        />
                        <span>Por fuerza mayor solicito cambiar de tutor par</span>
                      </label>

                      <label className="flex items-center space-x-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100">
                        <input
                          type="radio"
                          name="issueKind"
                          checked={issueKind === 'otro'}
                          onChange={() => setIssueKind('otro')}
                          className="text-brand-navy"
                        />
                        <span>Otro inconveniente académico con el alumno</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Módulo de Retorno Propuesto (Opcional)</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-xs rounded-lg text-slate-700 font-semibold"
                      value={proposedTime}
                      onChange={(e) => setProposedTime(e.target.value)}
                    >
                      <option value="">-- No proponer horario alternativo --</option>
                      {TIME_SLOTS.map(ts => (
                        <option key={ts} value={ts}>{ts}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-2.5">
                      Indica si hay algún horario de preferencia conversado previamente con el alumno.
                    </p>
                  </div>
                </div>

                {/* 3. Sugerir Tutor Suplente / Sustituto (Lista de Tutores) */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="block text-xs font-bold text-[#092c4c] dark:text-slate-200 uppercase flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-[#3a9ad9]" />
                      <span>Sugerir un Tutor para Suplir (Opcional)</span>
                      {issueKind === 'reasignar_tutor' && (
                        <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.2 rounded-full font-bold ml-1">
                          Recomendado
                        </span>
                      )}
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {otherTutores.length} tutor(es) en nómina
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Si conversaste previamente con un compañero o conoces a un tutor par disponible para cubrir tu sesión, puedes seleccionarlo en la lista para que la coordinación docente lo reasigne rápidamente.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <select
                        className="w-full bg-white border border-slate-300 px-3.5 py-2 text-xs rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-[#3a9ad9] focus:outline-hidden"
                        value={suggestedTutorId}
                        onChange={(e) => setSuggestedTutorId(e.target.value)}
                      >
                        <option value="">-- Seleccionar Tutor Sugerido para Suplir --</option>
                        {otherTutores.map(t => {
                          // Verificar si el tutor tiene disponibilidad declarada en el horario de la sesión
                          const tutorAvail = allAvailabilities.find(a => a.userId === t.id && (a.role === 'tutor' || !a.role));
                          let daySlotInfo = '';
                          if (selectedSessionForIssue && selectedSessionForIssue.date) {
                            const [year, month, day] = selectedSessionForIssue.date.split('-').map(Number);
                            const d = new Date(year, month - 1, day);
                            const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                            const dayName = days[d.getDay()];
                            const dayObj = tutorAvail?.days?.find(dItem => dItem.day.toLowerCase() === dayName.toLowerCase());
                            const hasSlot = dayObj?.slots?.includes(selectedSessionForIssue.timeSlot);
                            if (hasSlot) {
                              daySlotInfo = ' • (Disponible en este bloque)';
                            }
                          }

                          return (
                            <option key={t.id} value={t.id}>
                              {t.name} — {t.career || 'Tutor Par'}{daySlotInfo}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Resumen del tutor sugerido seleccionado */}
                    {suggestedTutorId ? (
                      <div className="bg-teal-50/80 border border-teal-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-teal-900">
                        <div className="space-y-0.5 truncate">
                          <p className="font-bold text-teal-950 truncate">
                            ✓ {otherTutores.find(t => t.id === suggestedTutorId)?.name}
                          </p>
                          <p className="text-[10px] text-teal-700 truncate">
                            {otherTutores.find(t => t.id === suggestedTutorId)?.career || 'Tutor Par'} • {otherTutores.find(t => t.id === suggestedTutorId)?.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSuggestedTutorId('')}
                          className="text-teal-600 hover:text-teal-900 p-1 rounded-md text-xs font-bold cursor-pointer shrink-0 ml-2"
                          title="Quitar sugerencia"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic flex items-center px-1">
                        Sin tutor suplente propuesto (el coordinador seleccionará uno de la nómina).
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Selección de Docentes Destinatarios */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-[#092c4c] dark:text-slate-200 uppercase flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-[#3a9ad9]" />
                        <span>Docentes Coordinadores a Notificar por Correo</span>
                      </label>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Selecciona a qué docentes coordinadores llegará el correo con este aviso. Por defecto están todos marcados.
                      </p>
                    </div>

                    {allDocentes.length > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedDocenteIds(allDocentes.map(d => d.id))}
                          className="px-2.5 py-1 text-[11px] font-bold text-[#092c4c] hover:bg-slate-200/80 rounded-lg transition cursor-pointer"
                        >
                          Marcar Todos
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDocenteIds([])}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-slate-200/80 rounded-lg transition cursor-pointer"
                        >
                          Desmarcar Todos
                        </button>
                      </div>
                    )}
                  </div>

                  {allDocentes.length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-white p-3 rounded-lg border border-slate-200">
                      No hay docentes registrados en el sistema.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                      {allDocentes.map(docente => {
                        const isChecked = selectedDocenteIds.includes(docente.id);
                        return (
                          <label
                            key={docente.id}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                              isChecked
                                ? 'bg-sky-50/70 border-sky-300 text-slate-900 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDocenteIds(prev => [...prev, docente.id]);
                                } else {
                                  setSelectedDocenteIds(prev => prev.filter(id => id !== docente.id));
                                }
                              }}
                              className="mt-0.5 rounded text-[#092c4c] focus:ring-[#3a9ad9] accent-[#092c4c]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{docente.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono truncate">{docente.email}</p>
                              <span className="inline-block mt-0.5 text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                {docente.career || 'Coordinación Docente'}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {selectedDocenteIds.length === 0 && allDocentes.length > 0 && (
                    <p className="text-[11px] text-rose-600 font-semibold animate-fade-in flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Debes seleccionar al menos un docente para enviar el aviso por correo.</span>
                    </p>
                  )}
                </div>

                {/* 5. Description text */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Descripciones y Justificaciones</label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 p-3 text-xs rounded-md text-slate-700 focus:bg-white"
                    placeholder="Escribe en detalle: por qué se solicita este cambio y qué problemas ocurrieron (ejemplo: motivos de enfermedad, tope de certámenes o inasistencias recurrentes de parte del alumno para planificar la reasignación)."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* Submit */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-brand-navy hover:bg-slate-900 text-white font-bold text-xs py-2.5 px-6 rounded-lg shadow-xs cursor-pointer transition-all flex items-center space-x-1.5"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500 animate-bounce" />
                    <span>Enviar Alerta al Coordinador</span>
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* My Availability declaration tab */}
          {activeTab === 'my_availability' && myAvailability && (
            <div id="tutor-availability-view" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 font-display flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#3a9ad9]" />
                    Declarar Mi Disponibilidad Semanal (Lunes a Domingo)
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isEditingSchedule
                      ? 'Haz clic directamente en las casillas del horario para marcar o desmarcar los bloques en los que tienes disponibilidad para dictar tutorías.'
                      : 'Este es tu horario actualmente guardado. Presiona "Editar Horario" para modificarlo.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 text-slate-600">
                      <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block"></span>
                      <strong className="text-slate-800">Disponible</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200 inline-block"></span>
                      <span>No disponible</span>
                    </span>
                  </div>
                  {!isEditingSchedule && (
                    <button
                      type="button"
                      onClick={() => {
                        scheduleSnapshotRef.current = myAvailability;
                        setIsEditingSchedule(true);
                      }}
                      className="bg-[#092c4c] hover:bg-slate-900 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-[#3a9ad9]" />
                      <span>Editar Horario</span>
                    </button>
                  )}
                </div>
              </div>

              {formFeedback && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-xs font-semibold animate-fade-in flex items-center space-x-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>{formFeedback}</span>
                </div>
              )}

              {/* HORARIO SEMANAL HORIZONTAL: LUNES A DOMINGO */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                <table className="w-full text-left border-collapse table-fixed min-w-[880px]">
                  <thead>
                    <tr className="bg-[#092c4c] text-white text-[11px] font-extrabold uppercase tracking-wider">
                      <th className="p-3.5 w-36 border-r border-[#153a5c] text-center bg-[#061e34]">
                        Bloque Horario
                      </th>
                      {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                        <th key={day} className="p-3.5 text-center border-r border-[#153a5c] last:border-r-0">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-150">
                    {TIME_SLOTS.map((slot, sIdx) => {
                      return (
                        <tr key={slot} className={`transition-colors ${sIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          {/* Columna Bloque de Horario */}
                          <td className="p-3 border-r border-slate-200 font-bold text-slate-700 bg-slate-100/70 text-center select-none">
                            <span className="text-[11px] font-mono text-[#092c4c]">{slot}</span>
                          </td>

                          {/* Columnas Lunes a Domingo */}
                          {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => {
                            const dayObjIndex = myAvailability.days.findIndex(d => d.day === day);
                            const isChecked = dayObjIndex !== -1 && myAvailability.days[dayObjIndex].slots.includes(slot);

                            return (
                              <td key={day} className="p-1.5 border-r border-slate-200 last:border-r-0 text-center align-middle">
                                <button
                                  type="button"
                                  disabled={!isEditingSchedule}
                                  onClick={() => {
                                    if (!isEditingSchedule) return;
                                    const newDays = [...myAvailability.days];
                                    let targetDayIndex = newDays.findIndex(d => d.day === day);
                                    if (targetDayIndex === -1) {
                                      newDays.push({ day, slots: [slot] });
                                    } else {
                                      if (isChecked) {
                                        newDays[targetDayIndex].slots = newDays[targetDayIndex].slots.filter(s => s !== slot);
                                      } else {
                                        newDays[targetDayIndex].slots = [...newDays[targetDayIndex].slots, slot];
                                      }
                                    }
                                    availabilityDirtyRef.current = true;
                                    setMyAvailability({
                                      ...myAvailability,
                                      days: newDays,
                                      updatedAt: new Date().toISOString()
                                    });
                                  }}
                                  className={`w-full py-2 px-1 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 select-none ${
                                    isEditingSchedule ? 'cursor-pointer' : 'cursor-default'
                                  } ${
                                    isChecked
                                      ? `bg-emerald-500 text-white shadow-xs ${isEditingSchedule ? 'hover:bg-emerald-600 scale-[0.98]' : 'opacity-90'}`
                                      : `bg-white text-slate-400 border border-dashed border-slate-200 ${isEditingSchedule ? 'hover:bg-slate-100 hover:text-slate-600' : ''}`
                                  }`}
                                  title={isEditingSchedule ? `Clic para ${isChecked ? 'quitar' : 'marcar'} disponibilidad: ${day} (${slot})` : 'Presiona "Editar Horario" para modificar'}
                                >
                                  {isChecked ? (
                                    <>
                                      <span className="text-[11px]">✓</span>
                                      <span className="text-[8.5px] uppercase font-extrabold tracking-wide">Disponible</span>
                                    </>
                                  ) : (
                                    <span className="text-[9px] text-slate-350 opacity-60 hover:opacity-100">+ Libre</span>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumen de Bloques Seleccionados */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  <span>📊 Total de módulos seleccionados: </span>
                  <strong className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full text-xs">
                    {myAvailability.days.reduce((acc, d) => acc + d.slots.length, 0)} bloques
                  </strong>
                </div>

                {isEditingSchedule && (
                <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (scheduleSnapshotRef.current) {
                      setMyAvailability(scheduleSnapshotRef.current);
                    }
                    availabilityDirtyRef.current = false;
                    setIsEditingSchedule(false);
                  }}
                  className="bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs py-2.5 px-4 rounded-xl border border-slate-200 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    const list = getSavedAvailabilities();
                    const filtered = list.filter(a => !(a.userId === user.id && a.role === 'tutor'));
                    const updatedAvail = {
                      ...myAvailability,
                      updatedAt: new Date().toISOString()
                    };
                    const nextList = [...filtered, updatedAvail];
                    saveAvailabilities(nextList);
                    setMyAvailability(updatedAvail);

                    // Sincronizar en MongoDB Atlas
                    try {
                      await fetch('/api/availabilities', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedAvail)
                      });
                    } catch (err) {
                      console.warn('Error sincronizando disponibilidad en Mongo:', err);
                    }

                    // Ya se guardó localmente y en Mongo: es seguro volver a aceptar recargas automáticas
                    availabilityDirtyRef.current = false;

                    // Notificar cambios entre pestañas mediante evento storage
                    window.dispatchEvent(new Event('storage'));

                    setIsEditingSchedule(false);
                    setFormFeedback("¡Tu disponibilidad semanal (Lunes a Domingo) ha sido guardada y comunicada a los Docentes!");
                    reloadData();
                    setTimeout(() => setFormFeedback(null), 4000);
                  }}
                  className="bg-[#092c4c] hover:bg-slate-900 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Check className="h-4 w-4 text-[#3a9ad9]" />
                  <span>Guardar Mi Disponibilidad Semanal</span>
                </button>
                </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: TUTORES A CARGO (EXCLUSIVO PARA TUTOR DE TUTORES) */}
          {activeTab === 'assigned_tutors' && isLeadTutor && (
            <div id="tutor-assigned-tutors-view" className="space-y-6 animate-fade-in">
              {/* Header Card */}
              <div className="bg-gradient-to-r from-[#092c4c] via-[#103a63] to-indigo-950 rounded-2xl shadow-sm p-6 text-white border border-indigo-300/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-indigo-500/30 rounded-lg text-indigo-300 border border-indigo-400/30">
                        <Users className="w-5 h-5" />
                      </span>
                      <h3 className="text-xl font-bold tracking-tight font-display">
                        Directorio de Tutores a Cargo
                      </h3>
                    </div>
                    <p className="text-xs text-indigo-200 max-w-2xl">
                      Nómina general e información de los tutores pares que tienes asignados. Consulta sus datos de contacto, carrera, tutorías programadas y alumnos participantes.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('compliance_review')}
                      className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-[#3a9ad9]" />
                      <span>Ir a Revisión de Cumplimiento &rarr;</span>
                    </button>
                    <span className="px-3.5 py-1.5 bg-indigo-500/20 border border-indigo-400/40 rounded-full text-xs font-bold text-indigo-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>{assignedTutors.length} Tutor(es)</span>
                    </span>
                  </div>
                </div>

                {/* Métricas Generales */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
                  <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                    <p className="text-[10px] uppercase font-bold text-indigo-200">Tutores Asignados</p>
                    <p className="text-xl font-extrabold text-white mt-0.5">{assignedTutors.length}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                    <p className="text-[10px] uppercase font-bold text-indigo-200">Tutorías Totales</p>
                    <p className="text-xl font-extrabold text-[#3a9ad9] mt-0.5">
                      {assignedTutors.reduce((acc, tut) => acc + sessions.filter(s => s.tutorId === tut.id).length, 0)}
                    </p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                    <p className="text-[10px] uppercase font-bold text-indigo-200">Estudiantes Inscritos</p>
                    <p className="text-xl font-extrabold text-indigo-200 mt-0.5">
                      {assignedTutors.reduce((acc, tut) => {
                        const tSessions = sessions.filter(s => s.tutorId === tut.id);
                        return acc + tSessions.reduce((sAcc, s) => sAcc + (s.studentIds?.length || 0), 0);
                      }, 0)}
                    </p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
                    <p className="text-[10px] uppercase font-bold text-indigo-200">Carreras Representadas</p>
                    <p className="text-xl font-extrabold text-indigo-200 mt-0.5">
                      {new Set(assignedTutors.map(t => t.career).filter(Boolean)).size || 1}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de Tutores Asignados */}
              {assignedTutors.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200 shadow-sm space-y-3">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Users className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-base">Aún no tienes tutores pares asignados a tu cargo</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    La coordinación docente te adjudicará tutores pares desde la pestaña <strong>"Gestión Tutores"</strong> en el Portal Docente. Una vez asignados, podrás ver sus datos de contacto y tutorías desde esta nómina.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignedTutors.map((tutor) => {
                    const tutorSessions = sessions.filter(s => s.tutorId === tutor.id);
                    const totalSessions = tutorSessions.length;
                    const totalStudentsEnrolled = tutorSessions.reduce((acc, s) => acc + (s.studentIds?.length || 0), 0);
                    const isExpanded = expandedTutorId === tutor.id;

                    return (
                      <div
                        key={tutor.id}
                        className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-indigo-300"
                      >
                        {/* Cabecera de la Tarjeta del Tutor */}
                        <div className="p-5 sm:p-6 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3.5">
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#092c4c] to-[#103a63] text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
                                {tutor.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-bold text-slate-900 text-base">{tutor.name}</h4>
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    {tutor.rut}
                                  </span>
                                </div>
                                <div className="text-xs text-[#3a9ad9] font-medium flex items-center gap-1.5 mt-0.5">
                                  <GraduationCap className="w-3.5 h-3.5 text-[#3a9ad9]" />
                                  <span>{tutor.career || 'Tutor Par'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Información de contacto */}
                            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-mono text-slate-700 font-medium">{tutor.email}</span>
                            </div>
                          </div>

                          {/* Resumen General de Actividad */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                            {/* 1. Tutorías Asignadas */}
                            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tutorías Asignadas</span>
                                <span className="text-xs font-extrabold text-slate-800">
                                  {totalSessions} {totalSessions === 1 ? 'sesión programada' : 'sesiones programadas'}
                                </span>
                              </div>
                              <Calendar className="w-4 h-4 text-slate-400" />
                            </div>

                            {/* 2. Total Alumnos */}
                            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Estudiantes Inscritos</span>
                                <span className="text-xs font-extrabold text-slate-800">
                                  {totalStudentsEnrolled} {totalStudentsEnrolled === 1 ? 'estudiante' : 'estudiantes'} en total
                                </span>
                              </div>
                              <Users className="w-4 h-4 text-slate-400" />
                            </div>

                            {/* 3. Modalidad / Asignaturas */}
                            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Asignaturas / Áreas</span>
                                <span className="text-xs font-extrabold text-slate-800 truncate max-w-[150px]" title={Array.from(new Set(tutorSessions.map(s => s.subject || s.title))).join(', ') || 'Sin registros'}>
                                  {Array.from(new Set(tutorSessions.map(s => s.subject || s.title))).join(', ') || 'Sin registros'}
                                </span>
                              </div>
                              <BookOpen className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setExpandedTutorId(isExpanded ? null : tutor.id)}
                              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Ocultar Nómina de Tutorías</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Ver Nómina de Tutorías ({totalSessions})</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setActiveTab('compliance_review')}
                              className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition flex items-center gap-1 cursor-pointer"
                            >
                              <span>Ver en Revisión de Cumplimiento</span>
                              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                            </button>
                          </div>
                        </div>

                        {/* Desplegable con Nómina de las Sesiones del Tutor */}
                        {isExpanded && (
                          <div className="bg-slate-50/90 border-t border-slate-200 p-5 sm:p-6 space-y-4 animate-fade-in">
                            <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-[#3a9ad9]" />
                              <span>Tutorías Registradas de {tutor.name}</span>
                            </h5>

                            {tutorSessions.length === 0 ? (
                              <p className="text-xs text-slate-400 italic bg-white p-4 rounded-xl border border-slate-200">
                                Este tutor aún no tiene tutorías programadas.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {tutorSessions.map((session) => {
                                  const registeredStudents = (session.studentIds || []).map(stId => allUsers.find(u => u.id === stId)).filter(Boolean) as User[];

                                  return (
                                    <div
                                      key={session.id}
                                      className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs space-y-3"
                                    >
                                      <div className="flex justify-between items-start gap-2">
                                        <div>
                                          <h6 className="font-bold text-slate-900 text-xs leading-snug">{session.title}</h6>
                                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                            📅 {session.date} • ⏰ {session.timeSlot}
                                          </p>
                                        </div>
                                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                          📍 {session.location}
                                        </span>
                                      </div>

                                      {/* Descripción / Temario General */}
                                      {session.syllabus && (
                                        <div className="p-2.5 rounded-lg text-xs bg-slate-50 border border-slate-150 space-y-1">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                                            <BookOpen className="w-3 h-3 text-indigo-600" />
                                            Temario / Contenido
                                          </span>
                                          <p className="text-[11px] text-slate-700 line-clamp-2 italic">
                                            "{session.syllabus}"
                                          </p>
                                        </div>
                                      )}

                                      {/* Alumnos Inscritos */}
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                                          <span>Estudiantes Inscritos ({registeredStudents.length})</span>
                                          <span className="text-slate-400 font-normal">Capacidad: {session.capacity || 10}</span>
                                        </div>
                                        {registeredStudents.length === 0 ? (
                                          <p className="text-[10px] text-slate-400 italic">Sin estudiantes inscritos aún.</p>
                                        ) : (
                                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                                            {registeredStudents.map(st => (
                                              <div key={st.id} className="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-1 rounded">
                                                <span className="font-semibold text-slate-800 truncate">{st.name}</span>
                                                <span className="text-[10px] font-mono text-slate-500">{st.rut || st.email}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: REVISIÓN CUMPLIMIENTO (EXCLUSIVO PARA TUTOR DE TUTORES) */}
          {activeTab === 'compliance_review' && isLeadTutor && (
            <div className="space-y-6 animate-fade-in" id="tutor-compliance-review-view">
              {/* Cabecera Principal */}
              <div className="bg-gradient-to-r from-[#092c4c] via-[#103a63] to-indigo-950 rounded-2xl shadow-sm p-6 text-white border border-indigo-300/30">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-indigo-500/30 rounded-lg text-indigo-300 border border-indigo-400/30">
                        <ClipboardCheck className="w-5 h-5" />
                      </span>
                      <h3 className="text-xl font-bold tracking-tight font-display">
                        Revisión de Cumplimiento de Tutorías
                      </h3>
                    </div>
                    <p className="text-xs text-indigo-200 max-w-2xl">
                      Auditoría individual y verificación del estado operativo de cada tutoría: temarios cargados, asistencia de estudiantes registrada e inconsistencias en las sesiones de los tutores pares a tu cargo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start md:self-center">
                    <span className="px-3.5 py-1.5 bg-indigo-500/20 border border-indigo-400/40 rounded-full text-xs font-bold text-indigo-100 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
                      <span>{assignedTutors.length} Tutor(es) a Cargo</span>
                    </span>
                  </div>
                </div>

                {/* Resumen Global de Estados de Cumplimiento */}
                {assignedTutors.length > 0 && (() => {
                  const allAssignedSessions = sessions.filter(s => s.tutorId && (effectiveUser.assignedTutorIds || []).includes(s.tutorId));
                  let cumplidas = 0;
                  let sinCronograma = 0;
                  let inconsistentes = 0;
                  let pendientes = 0;

                  allAssignedSessions.forEach(s => {
                    const st = getSessionComplianceStatus(s).status;
                    if (st === 'cumplida') cumplidas++;
                    else if (st === 'sin_cronograma') sinCronograma++;
                    else if (st === 'inconsistente') inconsistentes++;
                    else pendientes++;
                  });

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
                      <div className="bg-emerald-500/10 backdrop-blur-xs p-3 rounded-xl border border-emerald-400/20">
                        <p className="text-[10px] uppercase font-bold text-emerald-200">Cumplidas</p>
                        <p className="text-xl font-extrabold text-emerald-300 mt-0.5">{cumplidas}</p>
                      </div>
                      <div className="bg-amber-500/10 backdrop-blur-xs p-3 rounded-xl border border-amber-400/20">
                        <p className="text-[10px] uppercase font-bold text-amber-200">Sin Cronograma</p>
                        <p className="text-xl font-extrabold text-amber-300 mt-0.5">{sinCronograma}</p>
                      </div>
                      <div className="bg-rose-500/10 backdrop-blur-xs p-3 rounded-xl border border-rose-400/20">
                        <p className="text-[10px] uppercase font-bold text-rose-200">Inconsistentes</p>
                        <p className="text-xl font-extrabold text-rose-300 mt-0.5">{inconsistentes}</p>
                      </div>
                      <div className="bg-slate-500/10 backdrop-blur-xs p-3 rounded-xl border border-slate-400/20">
                        <p className="text-[10px] uppercase font-bold text-slate-200">Pendientes</p>
                        <p className="text-xl font-extrabold text-white mt-0.5">{pendientes}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {leadReminderFeedback && (
                <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fade-in shadow-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{leadReminderFeedback}</span>
                </div>
              )}

              {/* Barra de Filtros y Búsqueda */}
              {assignedTutors.length > 0 && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Filtro por Tutor */}
                    <select
                      value={complianceTutorFilter}
                      onChange={(e) => setComplianceTutorFilter(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                    >
                      <option value="all">Todos los Tutores ({assignedTutors.length})</option>
                      {assignedTutors.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>

                    {/* Filtro por Estado */}
                    <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                      {[
                        { key: 'all', label: 'Todos' },
                        { key: 'cumplida', label: 'Cumplidas' },
                        { key: 'sin_cronograma', label: 'Sin cronograma' },
                        { key: 'inconsistente', label: 'Inconsistentes' },
                        { key: 'pendiente', label: 'Pendientes' },
                      ].map(tab => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setComplianceStatusFilter(tab.key)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            complianceStatusFilter === tab.key
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Campo de búsqueda */}
                  <div className="relative w-full md:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por sesión o alumno..."
                      value={complianceSearch}
                      onChange={(e) => setComplianceSearch(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Guía explicativa institucional del cálculo de cumplimiento */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-[#092c4c]/10 text-[#092c4c] rounded-lg">
                    <HelpCircle className="w-4 h-4" />
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                    ¿Cómo se calcula el estado de cumplimiento de cada tutoría?
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <strong className="text-emerald-900 font-bold">Cumplida</strong>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Cronograma cargado a tiempo y 100% de la asistencia registrada.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <strong className="text-amber-900 font-bold">Sin Cronograma</strong>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Falta ingresar el temario previo a la realización de la sesión.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <strong className="text-rose-900 font-bold">Inconsistente</strong>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Fecha vencida sin pasar lista o con alerta de inconveniente activa.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      <strong className="text-slate-800 font-bold">Pendiente</strong>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Tutoría futura aún no realizada dentro del plazo normal.
                    </p>
                  </div>
                </div>
              </div>

              {/* Contenido Principal: Tarjetas por Tutor con sus Sesiones (Diseño de Imagen de Usuario) */}
              {assignedTutors.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200 shadow-sm space-y-3">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                    <ClipboardCheck className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-base">Aún no tienes tutores pares asignados</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    La coordinación docente (Ali / Viviana) te asignará tutores desde la pestaña <strong>"Gestión Tutores"</strong> del Portal Docente. En cuanto estén asignados, sus tutorías y estados de cumplimiento aparecerán aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {assignedTutors
                    .filter(t => complianceTutorFilter === 'all' || complianceTutorFilter === t.id)
                    .map(tutor => {
                      const tutorSessions = sessions.filter(s => s.tutorId === tutor.id);
                      
                      // Filtro de sesiones por estado y término de búsqueda
                      const filteredTutorSessions = tutorSessions.filter(s => {
                        const statusObj = getSessionComplianceStatus(s);
                        const matchStatus = complianceStatusFilter === 'all' || statusObj.status === complianceStatusFilter;
                        
                        const studentNames = (s.studentIds || []).map(stId => allUsers.find(u => u.id === stId)?.name || '').join(' ');
                        const searchLower = complianceSearch.toLowerCase();
                        const matchSearch = !searchLower || 
                          s.title.toLowerCase().includes(searchLower) ||
                          studentNames.toLowerCase().includes(searchLower) ||
                          (s.location && s.location.toLowerCase().includes(searchLower));

                        return matchStatus && matchSearch;
                      });

                      // Conteo de pendientes de revisión
                      const pendingReviewCount = tutorSessions.filter(s => {
                        const st = getSessionComplianceStatus(s).status;
                        return st === 'sin_cronograma' || st === 'inconsistente';
                      }).length;

                      const initials = tutor.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

                      return (
                        <div
                          key={tutor.id}
                          className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4 transition-all"
                        >
                          {/* Cabecera del Tutor (Idéntica al mockup de la imagen) */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3.5">
                              {/* Avatar Circular con Iniciales */}
                              <div className="w-11 h-11 rounded-full bg-[#e0f2fe] text-[#0369a1] font-bold text-sm flex items-center justify-center border border-[#bae6fd] shrink-0">
                                {initials}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 text-base leading-tight">
                                  {tutor.name}
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                  {tutorSessions.length} {tutorSessions.length === 1 ? 'tutoría este mes' : 'tutorías este mes'} · {pendingReviewCount} {pendingReviewCount === 1 ? 'pendiente de revisar' : 'pendientes de revisar'}
                                </p>
                              </div>
                            </div>

                            {/* Menú de Opciones Tres Puntos */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenTutorMenuId(openTutorMenuId === tutor.id ? null : tutor.id)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                title="Opciones"
                              >
                                <MoreHorizontal className="w-5 h-5" />
                              </button>

                              {openTutorMenuId === tutor.id && (
                                <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 animate-fade-in text-xs">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSendTutorReminder(tutor, 'general');
                                      setOpenTutorMenuId(null);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <Send className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Enviar recordatorio por correo</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setComplianceTutorFilter(tutor.id);
                                      setComplianceStatusFilter('sin_cronograma');
                                      setOpenTutorMenuId(null);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Ver tutorías sin cronograma</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setComplianceTutorFilter(tutor.id);
                                      setComplianceStatusFilter('inconsistente');
                                      setOpenTutorMenuId(null);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Ver inconsistencias</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Lista de Filas de Tutorías (Diseño idéntico a los rectángulos de la imagen + Desplegable al hacer click) */}
                          <div className="space-y-2.5 pt-1">
                            {filteredTutorSessions.length === 0 ? (
                              <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-400 border border-dashed border-slate-200">
                                No se encontraron tutorías para este tutor con los filtros seleccionados.
                              </div>
                            ) : (
                              filteredTutorSessions.map((session) => {
                                const compliance = getSessionComplianceStatus(session);
                                const isExpanded = Boolean(expandedComplianceSessionIds[session.id]);
                                const hasSyllabus = Boolean(session.syllabus && session.syllabus.trim().length > 0);
                                const registeredStudents = (session.studentIds || []).map(stId => allUsers.find(u => u.id === stId)).filter(Boolean) as User[];
                                
                                const attendances = session.attendance || {};
                                let presentCount = 0;
                                let absentCount = 0;
                                let pendingCount = 0;

                                (session.studentIds || []).forEach(stId => {
                                  const st = attendances[stId] || 'pendiente';
                                  if (st === 'presente') presentCount++;
                                  else if (st === 'ausente') absentCount++;
                                  else pendingCount++;
                                });

                                const studentReport = reports.find(r => r.sessionId === session.id && r.status === 'pendiente');
                                const sessionReport = studentReport;
                                const todayStr = new Date().toISOString().split('T')[0];
                                const isPastDate = session.date < todayStr;
                                const isToday = session.date === todayStr;

                                const studentNames = registeredStudents.map(st => st.name).join(', ');

                                // Calificaciones / Evaluaciones de estudiantes
                                const ratingsList = (Object.values(session.ratings || {}) as SessionFeedback[]);
                                const totalRatings = ratingsList.length;
                                const averageRating = totalRatings > 0 
                                  ? (ratingsList.reduce((acc, r) => acc + (r.rating || 0), 0) / totalRatings).toFixed(1)
                                  : null;

                                return (
                                  <div
                                    key={session.id}
                                    className={`bg-white border transition-all rounded-xl overflow-hidden shadow-2xs ${
                                      isExpanded ? 'border-indigo-300 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    {/* Fila Principal de la Tutoría (Clickable) */}
                                    <div
                                      onClick={() => toggleComplianceSession(session.id)}
                                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 transition-colors"
                                    >
                                      {/* Lado Izquierdo: Título con nombre de alumno y fecha/horario */}
                                      <div className="space-y-1 flex-1 pr-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-slate-900 text-sm leading-snug">
                                            {session.title} {studentNames ? `— ${studentNames}` : ''}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                                          <span>📅 {session.date}</span>
                                          <span>·</span>
                                          <span>⏰ {session.timeSlot}</span>
                                          {session.location && (
                                            <>
                                              <span>·</span>
                                              <span>📍 {session.location}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      {/* Lado Derecho: Nota / Calificación + Badge de Estado de Cumplimiento + Flecha de Despliegue */}
                                      <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 flex-wrap">
                                        {/* Badge de Calificación de Estudiantes */}
                                        {averageRating !== null ? (
                                          <span
                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs"
                                            title={`Promedio de satisfacción: ${averageRating} / 5.0 (${totalRatings} evaluación${totalRatings === 1 ? '' : 'es'})`}
                                          >
                                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                            <span>{averageRating}</span>
                                            <span className="text-[10px] text-amber-700 font-normal">({totalRatings})</span>
                                          </span>
                                        ) : (
                                          <span
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100/70 text-slate-400 border border-slate-200/50"
                                            title="Sesión aún sin evaluaciones registradas de alumnos"
                                          >
                                            <Star className="w-3 h-3 text-slate-300" />
                                            <span>Sin evaluar</span>
                                          </span>
                                        )}

                                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all ${compliance.badgeBg}`}>
                                          {compliance.label}
                                        </span>
                                        <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600 bg-slate-100/70">
                                          {isExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-indigo-600" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4" />
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Desglose Detallado de Parámetros de Cumplimiento al hacer click */}
                                    {isExpanded && (
                                      <div className="border-t border-slate-200/80 bg-[#f8fafc] p-5 sm:p-6 space-y-5 animate-fade-in text-xs">
                                        {/* Banner de Diagnóstico del Cumplimiento */}
                                        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                          <div className="space-y-0.5">
                                            <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                              <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                                              <span>Diagnóstico de Cumplimiento:</span>
                                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${compliance.badgeBg}`}>
                                                {compliance.label}
                                              </span>
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                              {compliance.description}
                                            </p>
                                          </div>

                                          {/* Acción de Recordatorio Rápido */}
                                          {(compliance.status === 'sin_cronograma' || compliance.status === 'inconsistente') && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const reason = compliance.status === 'sin_cronograma' 
                                                  ? 'Falta cargar cronograma/temario' 
                                                  : 'Falta registrar asistencia o resolver inconsistencia';
                                                handleSendSessionSpecificReminder(tutor, session, reason);
                                              }}
                                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                                            >
                                              <Send className="w-3.5 h-3.5 text-indigo-200" />
                                              <span>Notificar al Tutor</span>
                                            </button>
                                          )}
                                        </div>

                                        {/* Cuadrícula de Parámetros Auditados */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          
                                          {/* Parámetro 1: Carga de Cronograma / Temario */}
                                          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                <BookOpen className="w-4 h-4 text-indigo-600" />
                                                <span>1. Poner Cronograma / Temario</span>
                                              </div>
                                              {hasSyllabus ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                                  <Check className="w-3 h-3 text-emerald-600" /> Cumplido
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                                  <X className="w-3 h-3 text-amber-600" /> Sin Cronograma
                                                </span>
                                              )}
                                            </div>

                                            {hasSyllabus ? (
                                              <div className="p-3 bg-emerald-50/50 border border-emerald-200/60 rounded-lg">
                                                <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1">
                                                  Plan de Estudio Registrado:
                                                </p>
                                                <p className="text-slate-700 italic leading-relaxed">
                                                  "{session.syllabus}"
                                                </p>
                                              </div>
                                            ) : (
                                              <div className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-lg text-amber-900">
                                                <p className="text-[11px] leading-relaxed">
                                                  ⚠️ El tutor aún no ha definido el temario ni el plan de trabajo para esta sesión.
                                                </p>
                                              </div>
                                            )}
                                          </div>

                                          {/* Parámetro 2: Pasar Asistencia */}
                                          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                <Users className="w-4 h-4 text-indigo-600" />
                                                <span>2. Pasar Asistencia ({registeredStudents.length} alumnos)</span>
                                              </div>
                                              {registeredStudents.length === 0 ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-600">
                                                  Sin alumnos
                                                </span>
                                              ) : pendingCount === 0 ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                                  <Check className="w-3 h-3 text-emerald-600" /> 100% Registrada
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                                                  {pendingCount} Pendiente(s)
                                                </span>
                                              )}
                                            </div>

                                            {registeredStudents.length === 0 ? (
                                              <p className="text-slate-400 italic p-3 bg-slate-50 rounded-lg text-[11px]">
                                                No hay alumnos inscritos en esta tutoría todavía.
                                              </p>
                                            ) : (
                                              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                                {registeredStudents.map(st => {
                                                  const att = attendances[st.id] || 'pendiente';
                                                  return (
                                                    <div
                                                      key={st.id}
                                                      className="flex items-center justify-between p-2 bg-slate-50 border border-slate-150 rounded-lg text-[11px]"
                                                    >
                                                      <div className="truncate mr-2">
                                                        <span className="font-semibold text-slate-800">{st.name}</span>
                                                        <span className="text-[10px] text-slate-400 ml-1.5 font-mono">{st.rut || st.career || 'Estudiante'}</span>
                                                      </div>
                                                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                                                        att === 'presente'
                                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                          : att === 'ausente'
                                                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                      }`}>
                                                        {att === 'presente' ? '✓ Presente' : att === 'ausente' ? '✗ Ausente' : '⏳ Pendiente'}
                                                      </span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>

                                          {/* Parámetro 3: Fecha y Ejecución Temporal */}
                                          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                <Clock className="w-4 h-4 text-indigo-600" />
                                                <span>3. Ejecución Temporal y Fecha</span>
                                              </div>
                                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                                isPastDate 
                                                  ? 'bg-slate-100 text-slate-700' 
                                                  : isToday 
                                                  ? 'bg-sky-100 text-sky-800 border border-sky-200' 
                                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                              }`}>
                                                {isPastDate ? 'Fecha Pasada' : isToday ? 'Hoy' : 'Próxima'}
                                              </span>
                                            </div>

                                            <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-lg space-y-1 text-[11px] text-slate-600">
                                              <p><strong>Fecha programada:</strong> {session.date} ({session.timeSlot})</p>
                                              <p><strong>Ubicación / Sala:</strong> {session.location || 'Por coordinar'}</p>
                                              <p>
                                                <strong>Estado de cierre:</strong>{' '}
                                                {isPastDate && pendingCount > 0 ? (
                                                  <span className="text-rose-600 font-bold">Inconsistente (la fecha ya pasó y no se cerró la asistencia)</span>
                                                ) : isPastDate && pendingCount === 0 ? (
                                                  <span className="text-emerald-600 font-bold">Finalizada en tiempo y forma</span>
                                                ) : (
                                                  <span className="text-slate-600">En curso / agendada</span>
                                                )}
                                              </p>
                                            </div>
                                          </div>

                                          {/* Parámetro 4: Inconvenientes y Alertas */}
                                          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                <AlertTriangle className="w-4 h-4 text-indigo-600" />
                                                <span>4. Inconvenientes / Alertas</span>
                                              </div>
                                              {sessionReport ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                                                  Alerta Activa
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                                  <Check className="w-3 h-3 text-emerald-600" /> Sin Alertas
                                                </span>
                                              )}
                                            </div>

                                            {sessionReport ? (
                                              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1 text-[11px]">
                                                <p className="font-bold">⚠️ Reporte de tutor registrado:</p>
                                                <p className="italic">"{sessionReport.description}"</p>
                                                {sessionReport.proposedTime && (
                                                  <p className="text-[10px] text-rose-700">Horario alternativo propuesto: {sessionReport.proposedTime}</p>
                                                )}
                                              </div>
                                            ) : (
                                              <p className="text-slate-500 italic p-3 bg-slate-50 rounded-lg text-[11px]">
                                                No existen reportes ni solicitudes de reasignación para esta tutoría.
                                              </p>
                                            )}
                                          </div>

                                          {/* Parámetro 5: Evaluación y Calificación de Estudiantes (Nota) */}
                                          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3 md:col-span-2">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                              <div className="flex items-center gap-2 font-bold text-slate-800">
                                                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                                <span>5. Evaluación y Nota de Satisfacción Estudiantil</span>
                                              </div>
                                              {averageRating !== null ? (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                  <div className="flex items-center gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((starNum) => (
                                                      <Star
                                                        key={starNum}
                                                        className={`w-3.5 h-3.5 ${
                                                          starNum <= Math.round(Number(averageRating))
                                                            ? 'text-amber-400 fill-amber-400'
                                                            : 'text-slate-200'
                                                        }`}
                                                      />
                                                    ))}
                                                  </div>
                                                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-amber-50 text-amber-900 border border-amber-200">
                                                    Nota: {averageRating} / 5.0
                                                  </span>
                                                  <span className="text-[11px] text-slate-500 font-medium">
                                                    ({totalRatings} {totalRatings === 1 ? 'evaluación' : 'evaluaciones'})
                                                  </span>
                                                </div>
                                              ) : (
                                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                  Sin evaluaciones de estudiantes
                                                </span>
                                              )}
                                            </div>

                                            {totalRatings > 0 ? (
                                              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                                {ratingsList.map((fb, idx) => {
                                                  const studentObj = allUsers.find(u => u.id === fb.studentId);
                                                  const name = fb.studentName || studentObj?.name || 'Estudiante';

                                                  return (
                                                    <div
                                                      key={idx}
                                                      className="p-3 bg-amber-50/40 border border-amber-150/70 rounded-xl space-y-1.5 text-[11px]"
                                                    >
                                                      <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                          <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-[10px] font-extrabold">
                                                            {name[0]}
                                                          </span>
                                                          <span>{name}</span>
                                                          {fb.createdAt && (
                                                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                                                              · {new Date(fb.createdAt).toLocaleDateString('es-CL')}
                                                            </span>
                                                          )}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                          {[1, 2, 3, 4, 5].map((starNum) => (
                                                            <Star
                                                              key={starNum}
                                                              className={`w-3 h-3 ${
                                                                starNum <= fb.rating
                                                                  ? 'text-amber-400 fill-amber-400'
                                                                  : 'text-slate-200'
                                                              }`}
                                                            />
                                                          ))}
                                                          <span className="font-bold text-amber-900 ml-1 text-[11px]">{fb.rating}.0</span>
                                                        </div>
                                                      </div>

                                                      {fb.comment ? (
                                                        <div className="pl-6.5 text-slate-600 italic bg-white/70 p-2 rounded-lg border border-amber-100">
                                                          "{fb.comment}"
                                                        </div>
                                                      ) : (
                                                        <p className="pl-6.5 text-slate-400 italic text-[10px]">
                                                          (El estudiante no dejó comentarios adicionales)
                                                        </p>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            ) : (
                                              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-slate-500 italic text-[11px] flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4 text-slate-400 shrink-0" />
                                                <span>Los alumnos que asistieron a esta tutoría aún no han completado la encuesta de satisfacción en su portal.</span>
                                              </div>
                                            )}
                                          </div>

                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Status Bar / Footer matching mockup */}
        <footer className="h-10 bg-[#061e34] dark:bg-slate-950 border-t border-white/10 flex items-center justify-between px-6 md:px-8 text-[10px] text-slate-300 dark:text-slate-400 font-bold uppercase tracking-wider mt-auto shrink-0 select-none transition-colors">
          <div>Portal del {isLeadTutor ? 'Tutor de Tutores' : 'Tutor Par'} | V 2.4</div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
              Sincronizado
            </span>
            <span className="hidden sm:inline">Inasistencias Notificadas Directo</span>
          </div>
        </footer>
      </main>

      {/* Modal de Notificaciones */}
      <NotificationModal
        isOpen={showNotifInbox}
        onClose={() => setShowNotifInbox(false)}
        userEmail={user.email}
        notifications={notifications}
        setNotifications={setNotifications}
        title="Bandeja de Mensajes y Comunicados"
        subtitle="Avisos oficiales y notificaciones del sistema de tutorías"
        senderLabel="Coordinación de Tutorías UFT"
      />

      {/* Modal de Código QR Grande */}
      <SessionQRModal
        session={activeQRModalSession}
        onClose={() => setActiveQRModalSession(null)}
        allUsers={allUsers}
      />

      {/* Modal de Tutorial Interactivo Guiado con Foco */}
      <TutorTutorialModal
        isOpen={isTutorialOpen}
        onClose={handleCloseTutorial}
        userName={effectiveUser.name}
        isLeadTutor={isLeadTutor}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          reloadData();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          const mainElem = document.getElementById('tutor-main-panel-workspace');
          if (mainElem) mainElem.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
