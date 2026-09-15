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
  Mail
} from 'lucide-react';

export type DocenteTabType = 
  | 'calendar' 
  | 'create' 
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
  const [showLogoutDropdown, setShowLogoutDropdown] = useState(false);

  const menuItems = [
    { id: 'calendar' as DocenteTabType, label: 'Panel Docente', icon: CalendarIcon },
    { id: 'create' as DocenteTabType, label: 'Registrar Horarios', icon: PlusCircle },
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
        <div className="p-5 mx-4 mt-5 mb-4 bg-white rounded-2xl shadow-md space-y-2.5 relative shrink-0">
          <div
            className="flex items-center gap-1.5 text-brand-celeste font-bold text-sm cursor-pointer w-fit"
            onClick={() => setShowLogoutDropdown(!showLogoutDropdown)}
            title="Click para ver opciones de sesión"
          >
            <UserIcon className="h-4 w-4" />
            <span>Perfil docente</span>
          </div>
          <div className="font-extrabold text-brand-navy text-sm leading-snug">{user.name}</div>
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <Mail className="h-3.5 w-3.5 text-brand-celeste shrink-0" />
            <span className="truncate">{user.email || 'Docente UFT'}</span>
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

        <div className="flex justify-center items-center">
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
  );
};
