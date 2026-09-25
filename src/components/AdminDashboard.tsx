import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getSavedSmtpSettings, saveSmtpSettings, getSavedUsers, saveUsers } from '../data';
import { usersApi, settingsApi } from '../services/api';
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
  ExternalLink 
} from 'lucide-react';
import { AdminDocentesTab } from './admin/AdminDocentesTab';
import { AdminTutoresTab } from './admin/AdminTutoresTab';
import { AdminAlumnosTab } from './admin/AdminAlumnosTab';
import { AdminSmtpTab } from './admin/AdminSmtpTab';
import { AdminMaintenanceTab } from './admin/AdminMaintenanceTab';
import { EditUserModal } from './admin/EditUserModal';
import { ThemeToggle } from './common/ThemeToggle';

import { useAuth } from '../context/AuthContext';

interface AdminDashboardProps {
  user?: User;
  onLogout?: () => void;
}

export default function AdminDashboard({ user: propUser, onLogout: propLogout }: AdminDashboardProps = {}) {
  const auth = useAuth();
  const user = propUser || auth.currentUser;
  const onLogout = propLogout || auth.logout;

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
  const [activeTab, setActiveTab] = useState<'docentes' | 'tutores' | 'alumnos' | 'smtp' | 'maintenance'>(() => {
    const saved = localStorage.getItem('uft_admin_active_tab');
    return (saved as 'docentes' | 'tutores' | 'alumnos' | 'smtp' | 'maintenance') || 'docentes';
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
  const [userSearch, setUserSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // New User Form State
  const [newDocName, setNewDocName] = useState('');
  const [newDocRut, setNewDocRut] = useState('');
  const [newDocEmail, setNewDocEmail] = useState('');
  const [newDocCareer, setNewDocCareer] = useState('Jefa de Trayectoria Estudiantil');
  const [newDocPassword, setNewDocPassword] = useState('123');
  const [docFeedback, setDocFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRut, setEditRut] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCareer, setEditCareer] = useState('');
  const [editPassword, setEditPassword] = useState('');
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
    let all = getSavedUsers() || [];
    try {
      const data = await usersApi.getUsers();
      if (Array.isArray(data) && data.length > 0) {
        all = data;
        saveUsers(data);
      }
    } catch (e) {
      console.warn('Usando usuarios de respaldo local');
    }
    const safeAll = Array.isArray(all) ? all : [];
    setAllUsers(safeAll);
    setDocentes(safeAll.filter(u => u && u.role === 'docente'));
    setTutores(safeAll.filter(u => u && u.role === 'tutor'));
    setAlumnos(safeAll.filter(u => u && u.role === 'alumno'));
    setIsLoadingUsers(false);
  };

  // Cargar configuración SMTP
  const loadSmtpSettings = async () => {
    setIsLoadingSmtp(true);
    const cached = getSavedSmtpSettings();
    if (cached) {
      if (cached.host) setSmtpHost(cached.host);
      if (cached.port) setSmtpPort(cached.port);
      if (typeof cached.secure === 'boolean') setSmtpSecure(cached.secure);
      if (cached.user) setSmtpUser(cached.user);
      if (cached.fromName) setSmtpFromName(cached.fromName);
      setHasStoredPassword(Boolean(cached.pass || cached.hasPassword));
      setIsConfigured(Boolean(cached.user && (cached.pass || cached.hasPassword)));
    }

    try {
      const data = await settingsApi.getSmtpSettings();
      if (data.host) setSmtpHost(data.host);
      if (data.port) setSmtpPort(data.port);
      if (typeof data.secure === 'boolean') setSmtpSecure(data.secure);
      if (data.user) setSmtpUser(data.user);
      if (data.fromName) setSmtpFromName(data.fromName);
      setHasStoredPassword(Boolean(data.hasPassword));
      setIsConfigured(Boolean(data.configured));
      saveSmtpSettings(data);
    } catch (err) {
      console.warn('Backend API no disponible para cargar SMTP, usando datos locales:', err);
    } finally {
      setIsLoadingSmtp(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadSmtpSettings();

    // Sincronización en tiempo real vía WebSockets
    const socket = getSocket();
    const handleUsersUpdate = () => {
      loadUsers();
    };

    socket.on('users:changed', handleUsersUpdate);

    return () => {
      socket.off('users:changed', handleUsersUpdate);
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
      career: newDocCareer.trim() || 'Coordinación Docente',
      password: newDocPassword.trim() || '123'
    };

    try {
      await usersApi.createUser(newDocenteUser);
      const all = getSavedUsers();
      const updatedAll = [...all, newDocenteUser];
      saveUsers(updatedAll);
      setDocentes(prev => [...prev, newDocenteUser]);

      setDocFeedback({
        status: 'success',
        message: `¡Docente "${newDocName}" creado exitosamente en MongoDB Atlas! Ya puede iniciar sesión con su RUT y contraseña.`
      });

      setNewDocName('');
      setNewDocRut('');
      setNewDocEmail('');
      setNewDocPassword('123');
      setNewDocCareer('Jefa de Trayectoria Estudiantil');
    } catch (err: any) {
      console.error('Error creando docente:', err);
      const all = getSavedUsers();
      const updatedAll = [...all, newDocenteUser];
      saveUsers(updatedAll);
      setDocentes(prev => [...prev, newDocenteUser]);

      setDocFeedback({
        status: 'success',
        message: `Docente registrado localmente en la plataforma. (${err.message})`
      });
      setNewDocName('');
      setNewDocRut('');
      setNewDocEmail('');
      setNewDocPassword('123');
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
    setEditPassword('');
    setEditFeedback(null);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditFeedback(null);

    if (!editName.trim() || !editRut.trim() || !editEmail.trim()) {
      setEditFeedback({ status: 'error', message: 'Nombre, RUT y Correo son obligatorios.' });
      return;
    }

    const cleanRut = editRut.replace(/[\.\-]/g, '').trim();
    if (cleanRut.length !== 9) {
      setEditFeedback({ status: 'error', message: 'El RUT debe tener exactamente 9 caracteres.' });
      return;
    }

    setIsUpdatingUser(true);

    const updatePayload: any = {
      name: editName.trim(),
      rut: editRut.trim(),
      email: editEmail.trim().toLowerCase(),
      career: editCareer.trim()
    };

    if (editPassword.trim()) {
      updatePayload.password = editPassword.trim();
    }

    try {
      await usersApi.updateUser(editingUser.id, updatePayload);
      const all = getSavedUsers();
      const updatedAll = all.map(u => u.id === editingUser.id ? { ...u, ...updatePayload } : u);
      saveUsers(updatedAll);

      setAllUsers(updatedAll);
      setDocentes(updatedAll.filter(u => u.role === 'docente'));
      setTutores(updatedAll.filter(u => u.role === 'tutor'));
      setAlumnos(updatedAll.filter(u => u.role === 'alumno'));

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
      const all = getSavedUsers();
      const updatedAll = all.map(u => u.id === editingUser.id ? { ...u, ...updatePayload } : u);
      saveUsers(updatedAll);
      setAllUsers(updatedAll);
      setDocentes(updatedAll.filter(u => u.role === 'docente'));
      setTutores(updatedAll.filter(u => u.role === 'tutor'));
      setAlumnos(updatedAll.filter(u => u.role === 'alumno'));

      setEditFeedback({
        status: 'success',
        message: `Cambios guardados localmente. (${err.message})`
      });
      setTimeout(() => {
        setEditingUser(null);
        setEditFeedback(null);
        loadUsers();
      }, 1500);
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    const isConfirmed = window.confirm(`¿Estás seguro de que deseas eliminar al usuario "${targetUser.name}"?\n\nEsta acción borrará su cuenta y accesos al sistema.`);
    if (!isConfirmed) return;

    try {
      await usersApi.deleteUser(targetUser.id);
      const all = getSavedUsers();
      const updatedAll = all.filter(u => u.id !== targetUser.id && u.rut !== targetUser.id);
      saveUsers(updatedAll);

      setDocentes(prev => prev.filter(d => d.id !== targetUser.id && d.rut !== targetUser.id));
      setTutores(prev => prev.filter(t => t.id !== targetUser.id && t.rut !== targetUser.id));
      setAlumnos(prev => prev.filter(a => a.id !== targetUser.id && a.rut !== targetUser.id));
    } catch (err: any) {
      console.error('Error al eliminar usuario:', err);
      const all = getSavedUsers();
      const updatedAll = all.filter(u => u.id !== targetUser.id && u.rut !== targetUser.id);
      saveUsers(updatedAll);
      setDocentes(prev => prev.filter(d => d.id !== targetUser.id && d.rut !== targetUser.id));
      setTutores(prev => prev.filter(t => t.id !== targetUser.id && t.rut !== targetUser.id));
      setAlumnos(prev => prev.filter(a => a.id !== targetUser.id && a.rut !== targetUser.id));
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

    saveSmtpSettings(configPayload);

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
        status: 'success',
        message: 'Configuración guardada localmente en la app.'
      });
      setIsConfigured(Boolean(smtpUser && (smtpPass || hasStoredPassword)));
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

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col transition-colors duration-200" id="admin-dashboard-wrapper">
      {/* Header Institucional */}
      <header className="bg-[#092c4c] text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="/UFT_LogoHorizontal_Blanco.png" 
              alt="Universidad Finis Terrae" 
              className="h-10 w-auto object-contain select-none pointer-events-none"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="border-l border-slate-600 pl-4">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight">Trayectoria <span className="text-[#3a9ad9]">UFT.</span></span>
                <span className="bg-[#3a9ad9]/20 text-[#3a9ad9] text-[10px] font-bold px-2 py-0.5 rounded border border-[#3a9ad9]/40 uppercase tracking-wider">
                  Admin Panel
                </span>
              </div>
              <p className="text-xs text-slate-300 font-light">Panel Central de Administración y Configuración TI</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-sm font-semibold">{user.name}</span>
              <span className="text-xs text-[#3a9ad9] font-mono">admin_root</span>
            </div>
            <ThemeToggle className="bg-[#061e34] text-amber-300 border-slate-700 hover:bg-[#0c2a47]" />
            <button
              onClick={onLogout}
              className="flex items-center gap-2 bg-rose-500/20 text-rose-200 hover:bg-rose-500 hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition border border-rose-500/30"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 mb-8">
          <button
            onClick={() => setActiveTab('docentes')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === 'docentes'
                ? 'bg-[#092c4c] text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Gestión de Docentes ({docentes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tutores')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === 'tutores'
                ? 'bg-[#092c4c] text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Tutores Pares ({tutores.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('alumnos')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === 'alumnos'
                ? 'bg-[#092c4c] text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Estudiantes ({alumnos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('smtp')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === 'smtp'
                ? 'bg-[#092c4c] text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Configuración SMTP & Pruebas</span>
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition ${
              activeTab === 'maintenance'
                ? 'bg-rose-700 text-white shadow-md'
                : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Limpieza & Vaciado Académico</span>
          </button>
        </div>

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
            newDocPassword={newDocPassword}
            setNewDocPassword={setNewDocPassword}
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
            editPassword={editPassword}
            setEditPassword={setEditPassword}
            isUpdatingUser={isUpdatingUser}
            editFeedback={editFeedback}
            onClose={() => setEditingUser(null)}
            onSave={handleSaveEditUser}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>Centro de Apoyo al Aprendizaje • Trayectoria Estudiantil UFT — Universidad Finis Terrae</p>
      </footer>
    </div>
  );
}
