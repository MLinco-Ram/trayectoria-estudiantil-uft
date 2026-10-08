import React, { useState } from 'react';
import { WebNotification } from '../../types';
import { Bell, X, CheckCheck, Mail } from 'lucide-react';
import { saveNotifications } from '../../data';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  notifications: WebNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<WebNotification[]>>;
  title?: string;
  subtitle?: string;
  senderLabel?: string;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  notifications,
  setNotifications,
  title = 'Bandeja de Mensajes y Comunicados',
  subtitle = 'Avisos oficiales y notificaciones del sistema institucional',
  senderLabel = 'Centro de Apoyo UFT',
}) => {
  const [notifTimeframe, setNotifTimeframe] = useState<'week' | 'all'>('week');

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = async () => {
    const marked = notifications.map(n => ({ ...n, read: true }));
    setNotifications(marked);
    saveNotifications(marked);
    try {
      if (userEmail) {
        await fetch('/api/notifications/read-all', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail })
        });
      }
    } catch (e) {
      console.warn('Error syncing read-all notifications', e);
    }
  };

  const handleMarkAsRead = async (notif: WebNotification) => {
    if (!notif.read) {
      const updated = notifications.map(n => n.id === notif.id ? { ...n, read: true } : n);
      setNotifications(updated);
      saveNotifications(updated);
      try {
        await fetch(`/api/notifications/${notif.id}/read`, { method: 'PUT' });
      } catch (e) {
        console.warn('Error marking notification read', e);
      }
    }
  };

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filteredList = notifTimeframe === 'week'
    ? notifications.filter(n => new Date(n.timestamp).getTime() >= sevenDaysAgo)
    : notifications;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#092c4c] dark:bg-slate-950 text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#3a9ad9] flex items-center justify-center text-[#092c4c] font-bold shadow-sm">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{title}</h3>
              <p className="text-[11px] text-slate-300">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions Bar & Timeframe Filter */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">Mostrar:</span>
            <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 dark:bg-slate-700 border border-slate-300 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setNotifTimeframe('week')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  notifTimeframe === 'week'
                    ? 'bg-white dark:bg-slate-900 text-[#092c4c] dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                📅 Última Semana (7 días)
              </button>
              <button
                type="button"
                onClick={() => setNotifTimeframe('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  notifTimeframe === 'all'
                    ? 'bg-white dark:bg-slate-900 text-[#092c4c] dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Histórico Completo
              </button>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="text-sky-600 dark:text-sky-400 hover:text-[#092c4c] dark:hover:text-sky-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Marcar todos como leídos</span>
            </button>
          )}
        </div>

        {/* Messages List */}
        <div className="p-6 overflow-y-auto space-y-3.5 flex-1 bg-white dark:bg-slate-900">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500 space-y-2">
              <Mail className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium">
                {notifTimeframe === 'week'
                  ? 'No has recibido comunicados ni avisos en los últimos 7 días.'
                  : 'No tienes mensajes en tu bandeja.'}
              </p>
              {notifTimeframe === 'week' && notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => setNotifTimeframe('all')}
                  className="text-[#3a9ad9] dark:text-sky-400 text-[11px] font-bold underline cursor-pointer hover:text-[#092c4c] dark:hover:text-sky-200"
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
                  onClick={() => handleMarkAsRead(notif)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer overflow-hidden min-w-0 ${
                    isUnread
                      ? 'bg-sky-50/70 dark:bg-sky-950/40 border-[#3a9ad9]/40 dark:border-[#3a9ad9]/30 shadow-xs'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#3a9ad9] shrink-0" title="No leído"></span>
                      )}
                      <h4 className={`text-xs break-words break-all ${isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                        {notif.subject}
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-mono">
                      {new Date(notif.timestamp).toLocaleString('es-CL', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words break-all leading-relaxed pl-4 border-l-2 border-slate-200 dark:border-slate-700 my-2 overflow-hidden">
                    {notif.message}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                    <span>Emisor: <strong className="text-slate-600 dark:text-slate-300">{senderLabel}</strong></span>
                    {isUnread ? (
                      <span className="text-[#3a9ad9] dark:text-sky-400 font-bold">Nuevo</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">Leído</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#092c4c] hover:bg-[#153a5c] text-white text-xs font-bold py-2 px-5 rounded-xl transition-all cursor-pointer shadow-sm"
          >
            Cerrar Bandeja
          </button>
        </div>
      </div>
    </div>
  );
};
