import React, { useState, useEffect } from 'react';
import { User, Role, TutorType } from '../types';
import { usersApi, settingsApi, pendingUsersApi } from '../services/api';
import { getSocket } from '../services/socket';
import { 
  ShieldCheck, 
  Mail, 
  LogOut, 
  Users, 
  UserPlus, 
  BookOpen, 
  Sliders, 
  Database, 
  ExternalLink,
  GraduationCap,
  ArrowLeftRight,
  ChevronDown,
  ClipboardList,
} from 'lucide-react';
import { AdminDocentesTab } from './admin/AdminDocentesTab';
import { AdminTutoresTab } from './admin/AdminTutoresTab';
import { AdminAlumnosTab } from './admin/AdminAlumnosTab';
import { AdminSmtpTab } from './admin/AdminSmtpTab';
import { AdminMaintenanceTab } from './admin/AdminMaintenanceTab';
import { AdminPendingTab } from './admin/AdminPendingTab';
import { EditUserModal } from './admin/EditUserModal';
import { ThemeToggle } from './common/ThemeToggle';

import { useNavigate } from 'react-router-dom';
import { useAuth, getRoleHomePath } from '../context/AuthContext';

interface AdminDashboardProps {
  user?: User;
  onLogout?: () => void;
}

const ADMIN_TABS = ['docentes', 'tutores', 'alumnos', 'pendientes', 'smtp', 'maintenance'] as const;
type AdminTab = typeof ADMIN_TABS[number];

export default function AdminDashboard({ user: propUser, onLogout: propLogout }: AdminDashboardProps = {}) {
  const auth = useAuth();
  const user = propUser || auth.currentUser;
  const onLogout = propLogout || auth.logout;
  const navigate = useNavigate();
  const [showPortalSwitcher, setShowPortalSwitcher] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#092c4c] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  // Navigation Tab State with persistence across reloads
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const saved = localStorage.getItem('uft_admin_active_tab') as AdminTab | null;
    return saved && ADMIN_TABS.includes(saved) ? saved : 'docentes';
  });

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('uft_admin_active_tab', activeTab);
    }
  }, [activeTab]);

  // All Users State from MongoDB
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [docentes, setDocentes] = useState<User[]>([]);
  const [tutores, setTutores] = useState<User[]>([]);
  const [alumnos, setAlumnos] = useState<User[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const loadPendingCount = async () => {
    try {
      setPendingCount((await pendingUsersApi.list()).length);
    } catch {
      // El contador es informativo: si falla, la pestaña Pendientes muestra el error
    }
  };
  const [userSearch, setUserSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // New User Form State
  const [newDocName, setNewDocName] = useState('');
  const [newDocRut, setNewDocRut] = useState('');
  const [newDocEmail, setNewDocEmail] = useState('');
  const [newDocCareer, setNewDocCareer] = useState('Jefa de Trayectoria Estudiantil');
  const [docFeedback, setDocFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRut, setEditRut] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCareer, setEditCareer] = useState('');
  const [editRoles, setEditRoles] = useState<Role[]>(['alumno']);
  const [editTutorTypes, setEditTutorTypes] = useState<TutorType[]>(['tutor_par']);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [editFeedback, setEditFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  // SMTP Form State
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('Trayectoria Estudiantil UFT');
  
  // Status states
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoadingSmtp, setIsLoadingSmtp] = useState(true);
  const [saveStatus, setSaveStatus] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  // Test Email State
  const [testRecipient, setTestRecipient] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  // Test Tutor Reminder State
  const [testTutorRecipient, setTestTutorRecipient] = useState('');
  const [isTestingTutor, setIsTestingTutor] = useState(false);
  const [tutorTestResult, setTutorTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  // Test Student Inconvenience Alert State
  const [testInconvenienceRecipient, setTestInconvenienceRecipient] = useState('');
  const [isTestingInconvenience, setIsTestingInconvenience] = useState(false);
  const [inconvenienceTestResult, setInconvenienceTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  // Cargar lista de Todos los Usuarios
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await usersApi.getUsers();
      if (Array.isArray(data)) {
        setAllUsers(data);
        setDocentes(data.filter(u => u && (u.role === 'docente' || (Array.isArray(u.roles) && u.roles.includes('docente')))));
        setTutores(data.filter(u => u && (u.role === 'tutor' || (Array.isArray(u.roles) && u.roles.includes('tutor')))));
        setAlumnos(data.filter(u => u && (u.role === 'alumno' || (Array.isArray(u.roles) && u.roles.includes('alumno')))));
      }
    } catch (e) {
      console.error('Error cargando usuarios desde MongoDB Atlas:', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Cargar configuración SMTP
  const loadSmtpSettings = async () => {
    setIsLoadingSmtp(true);
    try {
      const data = await settingsApi.getSmtpSettings();
      if (data.host) setSmtpHost(data.host);
      if (data.port) setSmtpPort(data.port);
      if (typeof data.secure === 'boolean') setSmtpSecure(data.secure);
      if (data.user) setSmtpUser(data.user);
      if (data.fromName) setSmtpFromName(data.fromName);
      setHasStoredPassword(Boolean(data.hasPassword));
      setIsConfigured(Boolean(data.configured));
    } catch (err) {
      console.error('Error cargando la configuración SMTP desde MongoDB Atlas:', err);
    } finally {
      setIsLoadingSmtp(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadSmtpSettings();
    loadPendingCount();

    // Sincronización en tiempo real vía WebSockets
    const socket = getSocket();
    const handleUsersUpdate = () => {
      loadUsers();
    };

    socket.on('users:changed', handleUsersUpdate);
    socket.on('pending_users:changed', loadPendingCount);

    return () => {
      socket.off('users:changed', handleUsersUpdate);
      socket.off('pending_users:changed', loadPendingCount);
    };
  }, []);

  // Crear nuevo Docente
  const handleCreateDocente = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocFeedback(null);

    if (!newDocName.trim() || !newDocRut.trim() || !newDocEmail.trim()) {
      setDocFeedback({ status: 'error', message: 'Nombre, RUT y Correo son obligatorios.' });
      return;
    }

    const cleanRut = newDocRut.replace(/[\.\-]/g, '').trim();
    if (cleanRut.length !== 9) {
      setDocFeedback({ 
        status: 'error', 
        message: 'El RUT debe tener exactamente 9 caracteres (ej: 11111111-1 o 11222333-K).' 
      });
      return;
    }

    const cleanEmail = newDocEmail.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setDocFeedback({ status: 'error', message: 'Por favor, ingresa un correo electrónico válido.' });
      return;
    }

    setIsSubmittingDoc(true);

    const newDocenteUser: User = {
      id: `docente_${Date.now()}`,
      name: newDocName.trim(),
      rut: newDocRut.trim(),
      role: 'docente',
      email: cleanEmail,
      career: newDocCareer.trim() || 'Coordinación Docente'
    };

    try {
      await usersApi.createUser(newDocenteUser);
      setDocentes(prev => [...prev, newDocenteUser]);

      setDocFeedback({
        status: 'success',
        message: `¡Docente "${newDocName}" creado exitosamente en MongoDB Atlas! Se envió su contraseña inicial por correo.`
      });

      setNewDocName('');
      setNewDocRut('');
      setNewDocEmail('');
      setNewDocCareer('Jefa de Trayectoria Estudiantil');
    } catch (err: any) {
      console.error('Error creando docente:', err);
      setDocFeedback({
        status: 'error',
        message: err.message || 'No se pudo crear el docente en MongoDB Atlas.'
      });
    } finally {
      setIsSubmittingDoc(false);
      setTimeout(() => {
        loadUsers();
      }, 500);
    }
  };

  // Modal de Edición de Usuario
  const handleOpenEditUser = (targetUser: User) => {
    setEditingUser(targetUser);
    setEditName(targetUser.name || '');
    setEditRut(targetUser.rut || '');
    setEditEmail(targetUser.email || '');
    setEditCareer(targetUser.career || '');
    const userRoles: Role[] = (targetUser.roles && targetUser.roles.length > 0)
      ? targetUser.roles
      : [targetUser.role || 'alumno'];
    setEditRoles(userRoles);
    const userTutorTypes: TutorType[] = Array.isArray(targetUser.tutorTypes) && targetUser.tutorTypes.length > 0
      ? targetUser.tutorTypes
      : targetUser.tutorType
        ? [targetUser.tutorType]
        : ['tutor_par'];
    setEditTutorTypes(userTutorTypes);
    setEditFeedback(null);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditFeedback(null);

    // El RUT es opcional: las cuentas registradas desde Pendientes no lo tienen y entran con su correo
    if (!editName.trim() || !editEmail.trim()) {
      setEditFeedback({ status: 'error', message: 'Nombre y Correo son obligatorios.' });
      return;
    }

    const cleanRut = editRut.replace(/[\.\-]/g, '').trim();
    if (cleanRut && cleanRut.length !== 9) {
      setEditFeedback({ status: 'error', message: 'El RUT debe tener exactamente 9 caracteres.' });
      return;
    }

    if (!editRoles || editRoles.length === 0) {
      setEditFeedback({ status: 'error', message: 'Debe asignar al menos un rol al usuario.' });
      return;
    }

    setIsUpdatingUser(true);

    const primaryRole = editRoles[0] || editingUser.role || 'alumno';
    const updatePayload: any = {
      name: editName.trim(),
      rut: editRut.trim(),
      email: editEmail.trim().toLowerCase(),
      career: editCareer.trim(),
      role: primaryRole,
      roles: editRoles,
      tutorTypes: editRoles.includes('tutor') ? editTutorTypes : undefined,
      tutorType: editRoles.includes('tutor') ? (editTutorTypes[0] || 'tutor_par') : undefined,
    };


    try {
      await usersApi.updateUser(editingUser.id, updatePayload);
      const updatedAll = allUsers.map(u => u.id === editingUser.id ? { ...u, ...updatePayload } : u);

      setAllUsers(updatedAll);
      setDocentes(updatedAll.filter(u => u && (u.role === 'docente' || (Array.isArray(u.roles) && u.roles.includes('docente')))));
      setTutores(updatedAll.filter(u => u && (u.role === 'tutor' || (Array.isArray(u.roles) && u.roles.includes('tutor')))));
      setAlumnos(updatedAll.filter(u => u && (u.role === 'alumno' || (Array.isArray(u.roles) && u.roles.includes('alumno')))));

      setEditFeedback({
        status: 'success',
        message: `¡Usuario ${editingUser.name} actualizado exitosamente en MongoDB Atlas!`
      });

      setTimeout(() => {
        setEditingUser(null);
        setEditFeedback(null);
        loadUsers();
      }, 1500);
    } catch (err: any) {
      console.error('Error actualizando usuario:', err);
      setEditFeedback({
        status: 'error',
        message: err.message || 'No se pudieron guardar los cambios en MongoDB Atlas.'
      });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    const isConfirmed = window.confirm(`¿Estás seguro de que deseas eliminar al usuario "${targetUser.name}"?\n\nEsta acción borrará su cuenta y accesos al sistema.`);
    if (!isConfirmed) return;

    try {
      await usersApi.deleteUser(targetUser.id);

      setAllUsers(prev => prev.filter(u => u.id !== targetUser.id && u.rut !== targetUser.id));
      setDocentes(prev => prev.filter(d => d.id !== targetUser.id && d.rut !== targetUser.id));
      setTutores(prev => prev.filter(t => t.id !== targetUser.id && t.rut !== targetUser.id));
      setAlumnos(prev => prev.filter(a => a.id !== targetUser.id && a.rut !== targetUser.id));
    } catch (err: any) {
      console.error('Error al eliminar usuario:', err);
      window.alert(`No se pudo eliminar al usuario "${targetUser.name}" en MongoDB Atlas: ${err.message || 'error de conexión'}`);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);

    const configPayload = {
      host: smtpHost,
      port: Number(smtpPort),
      secure: smtpSecure,
      user: smtpUser,
      pass: smtpPass,
      fromName: smtpFromName
    };

    try {
      await settingsApi.saveSmtpSettings(configPayload);
      setSaveStatus({
        status: 'success',
        message: '¡Configuración guardada exitosamente en MongoDB Atlas! Los envíos de correo usarán estos parámetros.'
      });
      setSmtpPass('');
      loadSmtpSettings();
    } catch (err: any) {
      setSaveStatus({
        status: 'error',
        message: err.message || 'No se pudo guardar la configuración SMTP en MongoDB Atlas.'
      });
    }

    setTimeout(() => {
      setSaveStatus(null);
    }, 6000);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim()) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      await settingsApi.testSmtp(testRecipient);
      setTestResult({
        status: 'success',
        message: `¡Correo de prueba enviado con éxito a ${testRecipient}! Revisa tu bandeja de entrada.`
      });
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.message || 'Ocurrió un error al enviar el correo de prueba.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendTutorReminderTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTutorRecipient.trim()) return;

    setIsTestingTutor(true);
    setTutorTestResult(null);

    try {
      const res = await fetch('/api/cron/remind-tutors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTutorEmail: testTutorRecipient.trim() })
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setTutorTestResult({
          status: 'success',
          message: data.message || `¡Recordatorio de tutoría enviado exitosamente a ${testTutorRecipient}!`
        });
      } else {
        setTutorTestResult({
          status: 'error',
          message: data?.details || data?.error || 'No se pudo enviar el correo de recordatorio.'
        });
      }
    } catch (err: any) {
      setTutorTestResult({
        status: 'error',
        message: err.message || 'Error de conexión al enviar recordatorio de tutor.'
      });
    } finally {
      setIsTestingTutor(false);
    }
  };

  const handleSendInconvenienceTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTestingInconvenience(true);
    setInconvenienceTestResult(null);

    try {
      const res = await fetch('/api/test/student-inconvenience-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: testInconvenienceRecipient.trim() || undefined,
          studentName: 'Constanza Morales (Prueba)',
          career: 'Ingeniería Comercial',
          preferredTime: 'Lunes o Miércoles de 16:00 a 18:00',
          message: 'Tengo un choque de horario con la cátedra de Finanzas II. Solicito un horario flexible o tutoría individual de apoyo.'
        })
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setInconvenienceTestResult({
          status: 'success',
          message: data.message || '¡Alerta de inconveniente enviada con éxito a los docentes!'
        });
      } else {
        setInconvenienceTestResult({
          status: 'error',
          message: data?.details || data?.error || 'No se pudo enviar la alerta de prueba a los docentes.'
        });
      }
    } catch (err: any) {
      setInconvenienceTestResult({
        status: 'error',
        message: err.message || 'Error de conexión al enviar alerta de inconveniente.'
      });
    } finally {
      setIsTestingInconvenience(false);
    }
  };

  // Otros portales a los que este usuario puede cambiarse (según sus roles)
  const portalOptions: { key: string; label: string; icon: React.ElementType; target: User; path: string }[] = [];
  (Array.isArray(user.roles) ? user.roles : []).filter(r => r !== 'admin').forEach(r => {
    if (r === 'tutor') {
      const tutorTypes = Array.isArray(user.tutorTypes) && user.tutorTypes.length > 0
        ? user.tutorTypes
        : [user.tutorType || 'tutor_par'];
      if (tutorTypes.includes('tutor_par')) {
        portalOptions.push({ key: 'tutor_par', label: 'Portal Tutor Par', icon: BookOpen, target: { ...user, role: 'tutor', tutorType: 'tutor_par' }, path: '/tutor' });
      }
      if (tutorTypes.includes('tutor_de_tutores')) {
        portalOptions.push({ key: 'tutor_de_tutores', label: 'Portal Tutor de Tutores', icon: ShieldCheck, target: { ...user, role: 'tutor', tutorType: 'tutor_de_tutores' }, path: '/tutor' });
      }
    } else if (r === 'alumno') {
      portalOptions.push({ key: 'alumno', label: 'Portal Estudiante', icon: GraduationCap, target: { ...user, role: 'alumno' }, path: getRoleHomePath('alumno') });
    } else if (r === 'docente') {
      portalOptions.push({ key: 'docente', label: 'Portal Docente', icon: Users, target: { ...user, role: 'docente' }, path: getRoleHomePath('docente') });
    }
  });

  // Menú lateral (propuesta A): grupos Personas / Sistema con contadores
  const navGroups: { label: string; items: { key: AdminTab; label: string; icon: React.ElementType; count?: number; danger?: boolean }[] }[] = [
    {
      label: 'Personas',
      items: [
        { key: 'docentes', label: 'Docentes', icon: UserPlus, count: docentes.length },
        { key: 'tutores', label: 'Tutores', icon: BookOpen, count: tutores.length },
        { key: 'alumnos', label: 'Estudiantes', icon: GraduationCap, count: alumnos.length },
        { key: 'pendientes', label: 'Pendientes', icon: ClipboardList, count: pendingCount },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { key: 'smtp', label: 'Correo SMTP', icon: Mail },
        { key: 'maintenance', label: 'Mantenimiento', icon: Database, danger: true },
      ],
    },
  ];

  const TAB_INFO: Record<AdminTab, { title: string; subtitle: string }> = {
    docentes: { title: 'Docentes', subtitle: 'Coordinadores y practicantes con acceso al portal docente.' },
    tutores: { title: 'Tutores', subtitle: 'Tutores pares y tutores de tutores registrados.' },
    alumnos: { title: 'Estudiantes', subtitle: 'Estudiantes con cuenta en la plataforma.' },
    pendientes: { title: 'Pendientes', subtitle: 'Personas importadas que aún no tienen cuenta ni han recibido correo.' },
    smtp: { title: 'Correo SMTP', subtitle: 'Servidor de correo y pruebas de envío.' },
    maintenance: { title: 'Mantenimiento', subtitle: 'Vaciado de datos para el inicio de un nuevo semestre.' },
  };

  // Indicadores de la nómina activa (solo en las pestañas de personas)
  const peopleList = activeTab === 'docentes' ? docentes : activeTab === 'tutores' ? tutores : activeTab === 'alumnos' ? alumnos : null;
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const kpis = peopleList
    ? [
        { label: `${TAB_INFO[activeTab].title} registrados`, value: peopleList.length },
        { label: 'Nuevos en los últimos 30 días', value: peopleList.filter(u => u.createdAt && new Date(u.createdAt).getTime() >= monthAgo).length },
        { label: 'Con más de un rol', value: peopleList.filter(u => Array.isArray(u.roles) && u.roles.length > 1).length },
        { label: 'Sin correo registrado', value: peopleList.filter(u => !u.email).length, warn: true },
      ]
    : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col lg:flex-row transition-colors duration-200" id="admin-dashboard-wrapper">
      {/* Menú lateral institucional */}
      <aside className="bg-[#092c4c] text-slate-200 lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen flex flex-col z-40">
        <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3 lg:block">
          <div>
            <img
              src="/UFT_LogoHorizontal_Blanco.png"
              alt="Universidad Finis Terrae"
              className="h-8 w-auto object-contain select-none pointer-events-none mb-3 hidden lg:block"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="font-extrabold text-lg tracking-tight text-white whitespace-nowrap">Trayectoria <span className="text-[#3a9ad9]">UFT.</span></span>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#7fb4de]">Administración TI</p>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle className="bg-[#061e34] text-amber-300 border-slate-700 hover:bg-[#0c2a47]" />
            <button onClick={onLogout} className="p-2 rounded-xl bg-rose-500/20 text-rose-200 border border-rose-500/30" title="Cerrar sesión" aria-label="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="px-3 pb-3 flex flex-col gap-4 lg:flex-1 lg:overflow-y-auto" aria-label="Secciones del administrador">
          {navGroups.map(group => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <span className="px-3 pb-1 text-[10px] font-mono font-semibold uppercase tracking-widest text-[#6f97bd]">{group.label}</span>
              <div className="flex flex-wrap lg:flex-col gap-1 lg:gap-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a9ad9] ${
                        isActive
                          ? 'bg-[#3a9ad9]/25 text-white shadow-[inset_3px_0_0_#3a9ad9]'
                          : item.danger
                            ? 'text-rose-200 hover:bg-white/5'
                            : 'text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.count !== undefined && (
                        <span className={`text-[11px] font-mono px-1.5 rounded-full ${
                          item.key === 'pendientes' && item.count > 0 ? 'bg-[#3a9ad9] text-white' : 'text-slate-400'
                        }`}>{item.count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Perfil, cambio de portal y cierre de sesión */}
        <div className="hidden lg:flex flex-col gap-2 border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-[#3a9ad9] text-white flex items-center justify-center font-bold text-xs shrink-0">
              {user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-[#7fb4de] font-mono">Administrador</p>
            </div>
          </div>
          {portalOptions.length > 0 && (
            <div className="rounded-lg bg-white/5">
              <button
                type="button"
                onClick={() => setShowPortalSwitcher(!showPortalSwitcher)}
                aria-expanded={showPortalSwitcher}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span className="flex-1 text-left">Cambiar de portal</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPortalSwitcher ? 'rotate-180' : ''}`} />
              </button>
              {showPortalSwitcher && (
                <div className="px-1.5 pb-1.5 space-y-0.5">
                  {portalOptions.map(option => {
                    const OptionIcon = option.icon;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setShowPortalSwitcher(false);
                          auth.login(option.target);
                          navigate(option.path);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left text-xs font-semibold text-slate-200 hover:bg-[#3a9ad9] hover:text-white transition-colors"
                      >
                        <OptionIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <ThemeToggle className="bg-[#061e34] text-amber-300 border-slate-700 hover:bg-[#0c2a47]" />
            <button
              onClick={onLogout}
              className="flex-1 flex items-center justify-center gap-2 bg-rose-500/20 text-rose-200 hover:bg-rose-500 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold transition border border-rose-500/30"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{TAB_INFO[activeTab].title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{TAB_INFO[activeTab].subtitle}</p>
        </div>

        {kpis.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {kpis.map(k => (
              <div key={k.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
                <p className={`text-2xl font-extrabold tabular-nums ${k.warn && k.value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{k.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content Views */}
        {activeTab === 'docentes' && (
          <AdminDocentesTab
            docentes={docentes}
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            newDocName={newDocName}
            setNewDocName={setNewDocName}
            newDocRut={newDocRut}
            setNewDocRut={setNewDocRut}
            newDocEmail={newDocEmail}
            setNewDocEmail={setNewDocEmail}
            newDocCareer={newDocCareer}
            setNewDocCareer={setNewDocCareer}
            docFeedback={docFeedback}
            isSubmittingDoc={isSubmittingDoc}
            handleCreateDocente={handleCreateDocente}
            handleOpenEditUser={handleOpenEditUser}
            handleDeleteUser={handleDeleteUser}
          />
        )}

        {activeTab === 'tutores' && (
          <AdminTutoresTab
            tutores={tutores}
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            handleOpenEditUser={handleOpenEditUser}
            handleDeleteUser={handleDeleteUser}
          />
        )}

        {activeTab === 'alumnos' && (
          <AdminAlumnosTab
            alumnos={alumnos}
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            handleOpenEditUser={handleOpenEditUser}
            handleDeleteUser={handleDeleteUser}
          />
        )}

        {activeTab === 'pendientes' && <AdminPendingTab onRegistered={() => { loadUsers(); loadPendingCount(); }} />}

        {activeTab === 'smtp' && (
          <AdminSmtpTab
            smtpHost={smtpHost}
            setSmtpHost={setSmtpHost}
            smtpPort={smtpPort}
            setSmtpPort={setSmtpPort}
            smtpSecure={smtpSecure}
            setSmtpSecure={setSmtpSecure}
            smtpUser={smtpUser}
            setSmtpUser={setSmtpUser}
            smtpPass={smtpPass}
            setSmtpPass={setSmtpPass}
            smtpFromName={smtpFromName}
            setSmtpFromName={setSmtpFromName}
            hasStoredPassword={hasStoredPassword}
            isConfigured={isConfigured}
            isLoadingSmtp={isLoadingSmtp}
            saveStatus={saveStatus}
            handleSaveSmtp={handleSaveSettings}
            testRecipient={testRecipient}
            setTestRecipient={setTestRecipient}
            isTesting={isTesting}
            testResult={testResult}
            handleTestEmail={handleSendTest}
            testTutorRecipient={testTutorRecipient}
            setTestTutorRecipient={setTestTutorRecipient}
            isTestingTutor={isTestingTutor}
            tutorTestResult={tutorTestResult}
            handleTestTutorReminder={handleSendTutorReminderTest}
            testInconvenienceRecipient={testInconvenienceRecipient}
            setTestInconvenienceRecipient={setTestInconvenienceRecipient}
            isTestingInconvenience={isTestingInconvenience}
            inconvenienceTestResult={inconvenienceTestResult}
            handleTestInconvenienceAlert={handleSendInconvenienceTest}
          />
        )}

        {activeTab === 'maintenance' && (
          <AdminMaintenanceTab
            onSuccessReset={() => {
              loadUsers();
            }}
          />
        )}

        {/* Modal de Edición de Usuario */}
        {editingUser && (
          <EditUserModal
            editingUser={editingUser}
            editName={editName}
            setEditName={setEditName}
            editRut={editRut}
            setEditRut={setEditRut}
            editEmail={editEmail}
            setEditEmail={setEditEmail}
            editCareer={editCareer}
            setEditCareer={setEditCareer}
            editRoles={editRoles}
            setEditRoles={setEditRoles}
            editTutorTypes={editTutorTypes}
            setEditTutorTypes={setEditTutorTypes}
            isUpdatingUser={isUpdatingUser}
            editFeedback={editFeedback}
            onClose={() => setEditingUser(null)}
            onSave={handleSaveEditUser}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>Centro de Apoyo al Aprendizaje • Trayectoria Estudiantil UFT — Universidad Finis Terrae</p>
      </footer>
      </div>
    </div>
  );
}
