import React, { useState, useEffect } from 'react';
import { User, Session, IssueReport, UserAvailability, StudentRequest, WebNotification } from '../types';
import { 
  getSavedSessions, 
  saveSessions, 
  getSavedReports, 
  saveReports, 
  getSavedAvailabilities, 
  saveAvailabilities, 
  getSavedStudentRequests, 
  saveStudentRequests, 
  getSavedUsers, 
  saveUsers,
  getSavedNotifications,
  saveNotifications
} from '../data';
import { usersApi, sessionsApi, reportsApi, studentRequestsApi, availabilitiesApi, broadcastApi } from '../services/api';
import { getSocket } from '../services/socket';
import { DocenteSidebar, DocenteTabType } from './docente/DocenteSidebar';
import { DocenteCalendarTab } from './docente/DocenteCalendarTab';
import { DocenteCreateSessionTab } from './docente/DocenteCreateSessionTab';
import { DocenteAttendanceTab } from './docente/DocenteAttendanceTab';
import { DocenteFlexScheduleTab } from './docente/DocenteFlexScheduleTab';
import { DocenteTutorsTab } from './docente/DocenteTutorsTab';
import { DocenteStudentsTab } from './docente/DocenteStudentsTab';
import { DocenteAlertsTab } from './docente/DocenteAlertsTab';
import { DocenteAnnouncementsTab } from './docente/DocenteAnnouncementsTab';
import { DocenteAnalyticsTab } from './docente/DocenteAnalyticsTab';
import { DocenteCommentsTab } from './docente/DocenteCommentsTab';
import { DocenteTutorialModal } from './docente/DocenteTutorialModal';
import { ThemeToggle } from './common/ThemeToggle';
import { NotificationModal } from './common/NotificationModal';

import { LogOut, GraduationCap, ShieldCheck, Bell, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DocenteDashboardProps {
  user?: User;
  onLogout?: () => void;
  onUpdateUser?: (user: User) => void;
}

export default function DocenteDashboard({ user: propUser, onLogout: propLogout, onUpdateUser: propUpdateUser }: DocenteDashboardProps = {}) {
  const auth = useAuth();
  const user = propUser || auth.currentUser;
  const onLogout = propLogout || auth.logout;
  const onUpdateUser = propUpdateUser || auth.updateUser;

  if (!user) return null;

  // Database States
  const [allUsers, setAllUsers] = useState<User[]>(getSavedUsers());
  const [sessions, setSessions] = useState<Session[]>(getSavedSessions());
  const [reports, setReports] = useState<IssueReport[]>(getSavedReports());
  const [studentRequests, setStudentRequests] = useState<StudentRequest[]>(getSavedStudentRequests());
  const [allAvailabilities, setAllAvailabilities] = useState<UserAvailability[]>(getSavedAvailabilities());
  const [notifications, setNotifications] = useState<WebNotification[]>(() => {
    const local = getSavedNotifications();
    return user.email ? local.filter(n => n.toEmail?.toLowerCase() === user.email.toLowerCase()) : local;
  });
  const [showNotifInbox, setShowNotifInbox] = useState(false);
  
  // Navigation tabs with localStorage persistence across page reloads
  const [activeTab, setActiveTab] = useState<DocenteTabType>(() => {
    const saved = localStorage.getItem('uft_docente_active_tab');
    return (saved as DocenteTabType) || 'calendar';
  });

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('uft_docente_active_tab', activeTab);
    }
  }, [activeTab]);

  // Mini-Tutoriales Modulares por Sección
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  // Auto-mostrar el mini-tutorial la primera vez que se entra a cada apartado
  useEffect(() => {
    if (activeTab) {
      const hasSeen = localStorage.getItem(`uft_docente_tutorial_seen_${activeTab}`);
      if (!hasSeen) {
        setIsTutorialOpen(true);
      }
    }
  }, [activeTab]);

  const handleCloseTutorial = () => {
    if (activeTab) {
      localStorage.setItem(`uft_docente_tutorial_seen_${activeTab}`, 'true');
    }
    setIsTutorialOpen(false);
  };

  const TAB_LABELS: Record<DocenteTabType, string> = {
    calendar: 'Panel Docente',
    create: 'Registrar Horarios',
    attendance: 'Pasar Lista',
    flex_schedule: 'Horario Flexible',
    tutors: 'Gestión Tutores',
    students: 'Alumnos',
    alerts: 'Alertas y Casos',
    announcements: 'Comunicados',
    analytics: 'Métricas',
    comments: 'Retroalimentación',
  };

  // Comments Filtering States
  const [commentFilterProgram, setCommentFilterProgram] = useState<'all' | 'tutorias' | 'psicoeducativo'>('all');
  const [commentFilterRating, setCommentFilterRating] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [commentSearch, setCommentSearch] = useState('');

  // Broadcast States
  const [broadcastScope, setBroadcastScope] = useState<'all_community' | 'all_students' | 'all_tutors' | 'specific_session'>('all_community');
  const [broadcastSessionId, setBroadcastSessionId] = useState('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'normal' | 'alta' | 'urgente'>('normal');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  // Recarga sincronizada desde MongoDB con fallback a almacenamiento local
  const loadData = async () => {
    try {
      const [uList, sList, rList, reqList, avList] = await Promise.all([
        usersApi.getUsers().catch(() => getSavedUsers()),
        sessionsApi.getSessions().catch(() => getSavedSessions()),
        reportsApi.getReports().catch(() => getSavedReports()),
        studentRequestsApi.getStudentRequests().catch(() => getSavedStudentRequests()),
        availabilitiesApi.getAvailabilities().catch(() => getSavedAvailabilities()),
      ]);

      if (Array.isArray(uList)) {
        setAllUsers(uList);
        saveUsers(uList);
      }
      if (Array.isArray(sList)) {
        setSessions(sList);
        saveSessions(sList);
      }
      if (Array.isArray(rList)) {
        setReports(rList);
        saveReports(rList);
      }
      if (Array.isArray(reqList)) {
        setStudentRequests(reqList);
        saveStudentRequests(reqList);
      }
      if (Array.isArray(avList)) {
        setAllAvailabilities(avList);
        saveAvailabilities(avList);
      }

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
    } catch (e) {
      console.warn('Cargando respaldo local de datos');
    }
  };

  useEffect(() => {
    loadData();

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
        loadData();
      }
    };

    const handleRealtimeUpdate = () => {
      loadData();
    };

    socket.on('sessions:changed', handleSessionsUpdate);
    socket.on('student_requests:changed', handleRealtimeUpdate);
    socket.on('reports:changed', handleRealtimeUpdate);
    socket.on('users:changed', handleRealtimeUpdate);
    socket.on('availabilities:changed', handleRealtimeUpdate);
    socket.on('notifications:changed', handleRealtimeUpdate);

    return () => {
      socket.off('sessions:changed', handleSessionsUpdate);
      socket.off('student_requests:changed', handleRealtimeUpdate);
      socket.off('reports:changed', handleRealtimeUpdate);
      socket.off('users:changed', handleRealtimeUpdate);
      socket.off('availabilities:changed', handleRealtimeUpdate);
      socket.off('notifications:changed', handleRealtimeUpdate);
    };
  }, [user.email]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastFeedback(null);

    if (!broadcastSubject.trim() || !broadcastMessage.trim()) {
      setBroadcastFeedback({ status: 'error', message: 'El asunto y el mensaje son obligatorios.' });
      return;
    }

    if (broadcastScope === 'specific_session' && !broadcastSessionId) {
      setBroadcastFeedback({ status: 'error', message: 'Por favor selecciona la tutoría destinataria.' });
      return;
    }

    setIsSendingBroadcast(true);

    try {
      const res = await broadcastApi.broadcastMessage({
        docenteName: user.name,
        scope: broadcastScope,
        sessionId: broadcastScope === 'specific_session' ? broadcastSessionId : undefined,
        subject: broadcastSubject,
        message: broadcastMessage,
        priority: broadcastPriority,
      });

      setBroadcastFeedback({
        status: 'success',
        message: res.message || `¡Comunicado oficial despachado exitosamente a los destinatarios!`
      });

      setBroadcastSubject('');
      setBroadcastMessage('');
    } catch (err: any) {
      setBroadcastFeedback({
        status: 'error',
        message: err.message || 'Error al despachar el comunicado oficial.'
      });
    } finally {
      setIsSendingBroadcast(false);
      setTimeout(() => loadData(), 1000);
    }
  };

  const pendingRequestsCount = studentRequests.filter(r => r.status === 'pendiente').length;
  const pendingReportsCount = reports.filter(r => r.status === 'pendiente').length;
  const unreadNotifCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-white dark:bg-slate-950 flex flex-col md:flex-row text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200" id="docente-dashboard-wrapper">
      {/* Sidebar de Navegación Modular Fija */}
      <DocenteSidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingRequestsCount={pendingRequestsCount}
        pendingReportsCount={pendingReportsCount}
        onLogout={onLogout}
        onOpenTutorial={() => setIsTutorialOpen(true)}
      />

      {/* Contenedor Principal con Cabecera Superior */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto relative z-10 bg-white dark:bg-slate-950 transition-colors duration-200">
        {/* Barra Superior */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-xs shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Panel de Coordinación y Docencia
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Botón de Mini-Tutorial Guiado para el Apartado Actual */}
            <button
              type="button"
              onClick={() => setIsTutorialOpen(true)}
              className="relative p-2 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title={`Repetir mini-tutorial guiado de "${TAB_LABELS[activeTab] || 'este apartado'}"`}
            >
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
                !
              </span>
              <span className="hidden sm:inline text-xs font-extrabold tracking-tight">
                Tutorial
              </span>
            </button>

            {/* Botón de Campana / Notificaciones */}
            <button
              type="button"
              onClick={() => setShowNotifInbox(true)}
              className="relative p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="Bandeja de Mensajes y Comunicados"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#e28743] text-white px-1.5 py-0.2 rounded-full text-[9px] font-extrabold border-2 border-white dark:border-slate-900">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            <ThemeToggle />
          </div>
        </header>

        {/* Modal de Notificaciones */}
        <NotificationModal
          isOpen={showNotifInbox}
          onClose={() => setShowNotifInbox(false)}
          userEmail={user.email}
          notifications={notifications}
          setNotifications={setNotifications}
          title="Bandeja de Mensajes y Comunicados"
          subtitle="Avisos institucionales, cambios de tutorías y comunicados de coordinación"
          senderLabel="Coordinación y Sistema UFT"
        />

        {/* Área Principal de Contenido */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full">

        {activeTab === 'calendar' && (
          <DocenteCalendarTab
            sessions={sessions}
            setSessions={setSessions}
            allUsers={allUsers}
            onReload={loadData}
          />
        )}

        {activeTab === 'create' && (
          <DocenteCreateSessionTab
            user={user}
            allUsers={allUsers}
            allAvailabilities={allAvailabilities}
            sessions={sessions}
            setSessions={setSessions}
            onReload={loadData}
          />
        )}

        {activeTab === 'attendance' && (
          <DocenteAttendanceTab
            sessions={sessions}
            setSessions={setSessions}
            allUsers={allUsers}
            onReload={loadData}
          />
        )}

        {activeTab === 'flex_schedule' && (
          <DocenteFlexScheduleTab
            studentRequests={studentRequests}
            setStudentRequests={setStudentRequests}
            allUsers={allUsers}
            allAvailabilities={allAvailabilities}
            sessions={sessions}
            setSessions={setSessions}
            onReload={loadData}
          />
        )}

        {activeTab === 'tutors' && (
          <DocenteTutorsTab
            allUsers={allUsers}
            setAllUsers={setAllUsers}
            onReload={loadData}
          />
        )}

        {activeTab === 'students' && (
          <DocenteStudentsTab
            allUsers={allUsers}
            setAllUsers={setAllUsers}
            onReload={loadData}
          />
        )}

        {activeTab === 'alerts' && (
          <DocenteAlertsTab
            reports={reports}
            setReports={setReports}
            sessions={sessions}
            setSessions={setSessions}
            allUsers={allUsers}
            onReload={loadData}
          />
        )}

        {activeTab === 'announcements' && (
          <DocenteAnnouncementsTab
            user={user}
            sessions={sessions}
            broadcastScope={broadcastScope}
            setBroadcastScope={setBroadcastScope}
            broadcastSessionId={broadcastSessionId}
            setBroadcastSessionId={setBroadcastSessionId}
            broadcastSubject={broadcastSubject}
            setBroadcastSubject={setBroadcastSubject}
            broadcastMessage={broadcastMessage}
            setBroadcastMessage={setBroadcastMessage}
            broadcastPriority={broadcastPriority}
            setBroadcastPriority={setBroadcastPriority}
            isSendingBroadcast={isSendingBroadcast}
            broadcastFeedback={broadcastFeedback}
            handleSendBroadcast={handleSendBroadcast}
          />
        )}

        {activeTab === 'analytics' && (
          <DocenteAnalyticsTab
            sessions={sessions}
            allUsers={allUsers}
            studentRequests={studentRequests}
            reports={reports}
          />
        )}

        {activeTab === 'comments' && (
          <DocenteCommentsTab
            sessions={sessions}
            allUsers={allUsers}
            commentFilterProgram={commentFilterProgram}
            setCommentFilterProgram={setCommentFilterProgram}
            commentFilterRating={commentFilterRating}
            setCommentFilterRating={setCommentFilterRating}
            commentSearch={commentSearch}
            setCommentSearch={setCommentSearch}
          />
        )}
      </main>
      </div>

      {/* Mini-Tutorial Guiado Modular por Apartado */}
      <DocenteTutorialModal
        isOpen={isTutorialOpen}
        onClose={handleCloseTutorial}
        activeTab={activeTab}
        userName={user.name}
      />
    </div>
  );
}

