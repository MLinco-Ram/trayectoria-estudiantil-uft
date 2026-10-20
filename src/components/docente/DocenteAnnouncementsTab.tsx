import React, { useMemo } from 'react';
import { User, Session, BroadcastScope } from '../../types';
import { Send, Radio, CheckCircle2, AlertTriangle, Users, BookOpen } from 'lucide-react';

interface DocenteAnnouncementsTabProps {
  user: User;
  sessions: Session[];
  broadcastScope: BroadcastScope;
  setBroadcastScope: (v: BroadcastScope) => void;
  broadcastSessionId: string;
  setBroadcastSessionId: (v: string) => void;
  allUsers: User[];
  broadcastUserId: string;
  setBroadcastUserId: (v: string) => void;
  broadcastSubject: string;
  setBroadcastSubject: (v: string) => void;
  broadcastMessage: string;
  setBroadcastMessage: (v: string) => void;
  broadcastPriority: 'normal' | 'alta' | 'urgente';
  setBroadcastPriority: (v: 'normal' | 'alta' | 'urgente') => void;
  isSendingBroadcast: boolean;
  broadcastFeedback: { status: 'success' | 'error'; message: string } | null;
  handleSendBroadcast: (e: React.FormEvent) => void;
}

export const DocenteAnnouncementsTab: React.FC<DocenteAnnouncementsTabProps> = ({
  user,
  sessions,
  broadcastScope,
  setBroadcastScope,
  broadcastSessionId,
  setBroadcastSessionId,
  allUsers,
  broadcastUserId,
  setBroadcastUserId,
  broadcastSubject,
  setBroadcastSubject,
  broadcastMessage,
  setBroadcastMessage,
  broadcastPriority,
  setBroadcastPriority,
  isSendingBroadcast,
  broadcastFeedback,
  handleSendBroadcast,
}) => {
  const hasRole = (u: User, role: string) => u.role === role || (Array.isArray(u.roles) && u.roles.includes(role as any));

  // Personas elegibles cuando el comunicado va a un destinatario específico
  const recipientOptions = useMemo(() => {
    if (broadcastScope === 'specific_tutor_par') {
      // Un tutor sin subroles declarados se considera tutor par
      return allUsers.filter(u => hasRole(u, 'tutor') && (
        u.tutorType === 'tutor_par' || (Array.isArray(u.tutorTypes) && u.tutorTypes.includes('tutor_par')) ||
        (!u.tutorType && !(Array.isArray(u.tutorTypes) && u.tutorTypes.length))
      ));
    }
    if (broadcastScope === 'specific_tutor_de_tutores') {
      return allUsers.filter(u => hasRole(u, 'tutor') && (
        u.tutorType === 'tutor_de_tutores' || (Array.isArray(u.tutorTypes) && u.tutorTypes.includes('tutor_de_tutores'))
      ));
    }
    if (broadcastScope === 'specific_student') {
      return allUsers.filter(u => hasRole(u, 'alumno'));
    }
    return [];
  }, [allUsers, broadcastScope]);
  const sortedRecipients = [...recipientOptions].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div id="docente-announcements-header" className="bg-gradient-to-r from-[#092c4c] to-[#153a5c] px-6 py-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl text-[#3a9ad9]">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Emisión de Comunicados y Avisos Oficiales</h2>
              <p className="text-xs text-slate-300">Despacha notificaciones por correo institucional y a la bandeja web de los alumnos</p>
            </div>
          </div>
        </div>

        <form id="docente-announcements-form" onSubmit={handleSendBroadcast} className="p-6 md:p-8 space-y-5">
          {broadcastFeedback && (
            <div className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
              broadcastFeedback.status === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {broadcastFeedback.status === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
              <span>{broadcastFeedback.message}</span>
            </div>
          )}

          <div id="docente-announcements-scope" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Destinatarios del Comunicado
              </label>
              <select
                value={broadcastScope}
                onChange={(e) => {
                  setBroadcastScope(e.target.value as BroadcastScope);
                  setBroadcastUserId('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white text-slate-800"
              >
                <option value="all_community">Toda la Comunidad (Estudiantes y Tutores)</option>
                <option value="all_students">Todos los Estudiantes Registrados</option>
                <option value="all_tutors">Equipo de Tutores Pares</option>
                <option value="specific_session">Alumnos de una Tutoría Específica</option>
                <option value="specific_tutor_par">Un Tutor Par Específico</option>
                <option value="specific_tutor_de_tutores">Un Tutor de Tutores Específico</option>
                <option value="specific_student">Un Estudiante Específico</option>
              </select>
            </div>

            {broadcastScope === 'specific_session' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Seleccionar Sesión de Tutoría
                </label>
                <select
                  value={broadcastSessionId}
                  onChange={(e) => setBroadcastSessionId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white text-slate-800"
                  required
                >
                  <option value="">-- Elige una sesión --</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.date} - {s.timeSlot}) - {(s.studentIds || []).length} inscritos
                    </option>
                  ))}
                </select>
              </div>
            ) : (broadcastScope === 'specific_tutor_par' || broadcastScope === 'specific_tutor_de_tutores' || broadcastScope === 'specific_student') ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  {broadcastScope === 'specific_student' ? 'Seleccionar Estudiante' : broadcastScope === 'specific_tutor_par' ? 'Seleccionar Tutor Par' : 'Seleccionar Tutor de Tutores'}
                </label>
                <select
                  value={broadcastUserId}
                  onChange={(e) => setBroadcastUserId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white text-slate-800"
                  required
                >
                  <option value="">-- Elige un destinatario --</option>
                  {sortedRecipients.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.career ? ` (${u.career})` : ''}
                    </option>
                  ))}
                </select>
                {sortedRecipients.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1.5">
                    {broadcastScope === 'specific_student' ? 'No hay estudiantes registrados.' : broadcastScope === 'specific_tutor_par' ? 'No hay tutores pares registrados.' : 'No hay tutores de tutores registrados.'}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nivel de Prioridad
                </label>
                <select
                  value={broadcastPriority}
                  onChange={(e) => setBroadcastPriority(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white text-slate-800"
                >
                  <option value="normal">Normal (Informativo)</option>
                  <option value="alta">Prioridad Alta (Importante)</option>
                  <option value="urgente">Urgente (Aviso Inmediato)</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Asunto del Comunicado
            </label>
            <input
              type="text"
              placeholder="Ej: Cambio de Sala para Talleres del Viernes / Apertura de Nuevos Cupos"
              value={broadcastSubject}
              onChange={(e) => setBroadcastSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mensaje Oficial
            </label>
            <textarea
              rows={5}
              placeholder="Escribe el cuerpo del mensaje que se notificará a los correos institucionales y portales de los destinatarios..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
              required
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSendingBroadcast}
              className="px-6 py-3 rounded-xl bg-[#092c4c] text-white font-bold text-sm hover:bg-[#0c3c66] transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSendingBroadcast ? 'Despachando Comunicado...' : 'Despachar Comunicado Oficial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
