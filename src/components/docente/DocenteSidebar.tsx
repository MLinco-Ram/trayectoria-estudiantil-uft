import React, { useState } from 'react';
import { User } from '../../types';
import { 
  Calendar as CalendarIcon, 
  PlusCircle, 
  CheckSquare, 
  Inbox, 
  TrendingUp, 
  Users, 
  BookOpen, 
  LogOut,
  AlertTriangle,
  Send,
  MessageSquare,
  ShieldCheck,
  User as UserIcon,
  GraduationCap,
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  DoorOpen
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useAuth, getRoleHomePath } from '../../context/AuthContext';

export type DocenteTabType = 
  | 'calendar' 
  | 'create' 
  | 'rooms'
  | 'attendance' 
  | 'alerts' 
  | 'analytics' 
  | 'comments' 
  | 'flex_schedule' 
  | 'tutors' 
  | 'students' 
  | 'announcements';

interface DocenteSidebarProps {
  user: User;
  activeTab: DocenteTabType;
  setActiveTab: (tab: DocenteTabType) => void;
  pendingRequestsCount: number;
  pendingReportsCount: number;
  onLogout: () => void;
}

export const DocenteSidebar: React.FC<DocenteSidebarProps> = ({
  user,
  activeTab,
  setActiveTab,
  pendingRequestsCount,
  pendingReportsCount,
  onLogout,
}) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [showPortalSwitcher, setShowPortalSwitcher] = useState(false);

  // Otros portales a los que este usuario puede cambiarse (según sus roles)
  const portalOptions: { key: string; label: string; icon: React.ElementType; target: User; path: string }[] = [];
  (Array.isArray(user.roles) ? user.roles : []).filter(r => r !== 'docente').forEach(r => {
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
    } else if (r === 'admin') {
      portalOptions.push({ key: 'admin', label: 'Panel Administrador', icon: ShieldCheck, target: { ...user, role: 'admin' }, path: getRoleHomePath('admin') });
    }
  });

  const menuItems = [
    { id: 'calendar' as DocenteTabType, label: 'Panel Docente', icon: CalendarIcon },
    { id: 'create' as DocenteTabType, label: 'Registrar Horarios', icon: PlusCircle },
    { id: 'rooms' as DocenteTabType, label: 'Salas', icon: DoorOpen },
    { id: 'attendance' as DocenteTabType, label: 'Pasar Lista', icon: CheckSquare },
    { 
      id: 'flex_schedule' as DocenteTabType, 
      label: 'Horario Flexible', 
      icon: Inbox,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
      badgeColor: 'bg-amber-500'
    },
    { id: 'tutors' as DocenteTabType, label: 'Gestión Tutores', icon: BookOpen },
    { id: 'students' as DocenteTabType, label: 'Alumnos', icon: Users },
    { 
      id: 'alerts' as DocenteTabType, 
      label: 'Alertas y Casos', 
      icon: AlertTriangle,
      badge: pendingReportsCount > 0 ? pendingReportsCount : null,
      badgeColor: 'bg-rose-500'
    },
    { id: 'announcements' as DocenteTabType, label: 'Comunicados', icon: Send },
    { id: 'analytics' as DocenteTabType, label: 'Métricas', icon: TrendingUp },
    { id: 'comments' as DocenteTabType, label: 'Retroalimentación', icon: MessageSquare },
  ];

  return (
    <aside className="hidden md:flex w-72 bg-black text-white flex-col shrink-0 justify-between relative overflow-hidden rounded-r-[2.5rem] sticky top-0 h-screen z-10 select-none">
      <div className="flex flex-col flex-1 overflow-y-auto relative z-10">
        {/* Tarjeta de Perfil del Docente */}
        <div className="p-5 mx-4 mt-5 mb-4 bg-white rounded-2xl shadow-md shrink-0">
          <div className="flex items-center gap-1.5 text-brand-celeste font-bold text-sm">
            <UserIcon className="h-4 w-4" />
            <span>Perfil docente</span>
          </div>

          <div className="mt-2.5 font-extrabold text-brand-navy text-sm leading-snug">{user.name}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-slate-500 text-xs">
            <GraduationCap className="h-3.5 w-3.5 text-brand-celeste shrink-0" />
            <span className="truncate">{user.career || 'Coordinación Docente UFT'}</span>
          </div>
          {user.rut && (
            <div className="mt-1 text-[11px] text-slate-400 font-mono">RUT: {user.rut}</div>
          )}

          {/* Cambio de portal: solo para usuarios con más de un rol. Se despliega dentro de la tarjeta, sin tapar el menú */}
          {portalOptions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowPortalSwitcher(!showPortalSwitcher)}
                aria-expanded={showPortalSwitcher}
                className="w-full flex items-center justify-between gap-2 text-xs font-bold text-brand-navy hover:text-brand-celeste transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5 text-brand-celeste" />
                  Cambiar de portal
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showPortalSwitcher ? 'rotate-180' : ''}`} />
              </button>

              {showPortalSwitcher && (
                <div className="mt-2 space-y-1.5 animate-fade-in">
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
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-brand-celeste hover:border-brand-celeste hover:text-white text-brand-navy text-xs font-semibold transition-colors cursor-pointer group"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <OptionIcon className="h-3.5 w-3.5 shrink-0 text-brand-celeste group-hover:text-white" />
                          <span className="truncate">{option.label}</span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation List con Scroll Interno */}
        <nav className="flex-1 px-4 space-y-2 pb-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-brand-celeste text-white shadow-md' 
                    : 'bg-white text-brand-navy hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-brand-navy'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`${item.badgeColor || 'bg-amber-500'} text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-1`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Botón de Cerrar Sesión fijo al final del Sidebar con Logo */}
      <div className="p-4 border-t border-white/10 shrink-0 relative z-10 space-y-3">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-600 transition-all cursor-pointer border border-rose-500/30 shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar Sesión</span>
        </button>

        <div className="flex justify-center items-center pt-2">
          <img
            src="/UFT_LogoHorizontal_Blanco.png"
            alt="Universidad Finis Terrae"
            className="h-8 w-auto object-contain select-none pointer-events-none"
          />
        </div>
      </div>
    </aside>
  );
};
