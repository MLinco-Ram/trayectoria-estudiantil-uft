import React from 'react';
import { User, Session } from '../../types';
import { Send, Radio, CheckCircle2, AlertTriangle, Users, BookOpen } from 'lucide-react';

interface DocenteAnnouncementsTabProps {
  user: User;
  sessions: Session[];
  broadcastScope: 'all_community' | 'all_students' | 'all_tutors' | 'specific_session';
  setBroadcastScope: (v: 'all_community' | 'all_students' | 'all_tutors' | 'specific_session') => void;
  broadcastSessionId: string;
  setBroadcastSessionId: (v: string) => void;
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
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#092c4c] to-[#153a5c] px-6 py-5 flex items-center justify-between text-white">
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

        <form onSubmit={handleSendBroadcast} className="p-6 md:p-8 space-y-5">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Destinatarios del Comunicado
              </label>
              <select
                value={broadcastScope}
                onChange={(e) => setBroadcastScope(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white text-slate-800"
              >
                <option value="all_community">Toda la Comunidad (Estudiantes y Tutores)</option>
                <option value="all_students">Todos los Estudiantes Registrados</option>
                <option value="all_tutors">Equipo de Tutores Pares</option>
                <option value="specific_session">Alumnos de una Tutoría Específica</option>
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
