import React, { useState, useEffect } from 'react';
import { User, Session, IssueReport, UserAvailability, StudentRequest } from '../types';
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
  saveUsers 
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
import { ThemeToggle } from './common/ThemeToggle';

import { LogOut, GraduationCap, ShieldCheck } from 'lucide-react';
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

      if (Array.isArray(uList) && uList.length > 0) {
        setAllUsers(uList);
        saveUsers(uList);
      }
      if (Array.isArray(sList) && sList.length > 0) {
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

    return () => {
      socket.off('sessions:changed', handleSessionsUpdate);
      socket.off('student_requests:changed', handleRealtimeUpdate);
      socket.off('reports:changed', handleRealtimeUpdate);
      socket.off('users:changed', handleRealtimeUpdate);
      socket.off('availabilities:changed', handleRealtimeUpdate);
    };
  }, []);

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
      />

      {/* Contenedor Principal con Cabecera Superior */}
      <div className="flex-1 flex flex-col min-w-0 md:h-screen md:overflow-y-auto relative z-10 bg-white dark:bg-slate-950 transition-colors duration-200">
        {/* Barra Superior */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Panel de Coordinación y Docencia
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

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
    </div>
  );
}

