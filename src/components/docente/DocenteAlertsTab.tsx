import React, { useState } from 'react';
import { IssueReport, Session, User } from '../../types';
import { AlertTriangle, CheckCircle2, BookOpen, Clock, Users, ArrowRight, UserCheck } from 'lucide-react';
import { triggerNotification } from '../../data';
import { sessionsApi, reportsApi } from '../../services/api';

interface DocenteAlertsTabProps {
  reports: IssueReport[];
  setReports: React.Dispatch<React.SetStateAction<IssueReport[]>>;
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  allUsers: User[];
  onReload: () => void;
}

export const DocenteAlertsTab: React.FC<DocenteAlertsTabProps> = ({
  reports,
  setReports,
  sessions,
  setSessions,
  allUsers,
  onReload,
}) => {
  const [selectedTutorForReassign, setSelectedTutorForReassign] = useState<{ [reportId: string]: string }>({});
  const [actionFeedback, setActionFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  const tutores = allUsers.filter(u => u.role === 'tutor');

  const handleResolveReassignment = async (report: IssueReport) => {
    const newTutorId = selectedTutorForReassign[report.id];
    if (!newTutorId) {
      setActionFeedback({ status: 'error', message: 'Por favor selecciona un nuevo tutor sustituto.' });
      return;
    }

    try {
      const session = sessions.find(s => s.id === report.sessionId);
      if (session) {
        // Actualizar sesión con el nuevo tutor
        await sessionsApi.updateSession(session.id, { tutorId: newTutorId });
        
        const newTutor = allUsers.find(u => u.id === newTutorId);
        if (newTutor && newTutor.email) {
          triggerNotification(
            newTutor.email,
            newTutor.name,
            `Asignación de Tutoría Sustituta: "${session.title}"`,
            `Hola ${newTutor.name}, se te ha asignado como tutor sustituto en la sesión "${session.title}" programada para el ${session.date} (${session.timeSlot}).`
          );
        }
      }

      // Marcar reporte como resuelto
      const updatedReports = reports.map(r => r.id === report.id ? { ...r, status: 'resuelto' as const } : r);
      setReports(updatedReports);
      localStorage.setItem('uft_te_reports', JSON.stringify(updatedReports));

      setActionFeedback({
        status: 'success',
        message: '¡Reasignación de tutor completada con éxito y notificada al nuevo tutor!'
      });

      setTimeout(() => {
        setActionFeedback(null);
        onReload();
      }, 2500);
    } catch (err: any) {
      setActionFeedback({
        status: 'error',
        message: err.message || 'Error al procesar la reasignación.'
      });
    }
  };

  const pendingReports = reports.filter(r => r.status === 'pendiente');
  const resolvedReports = reports.filter(r => r.status === 'resuelto');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Incidencias y Alertas Reportadas por Tutores
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Topes de horario imprevistos, solicitudes de cambio de tutor y reasignación de módulos.
            </p>
          </div>
          <span className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-full">
            {pendingReports.length} pendientes
          </span>
        </div>

        {actionFeedback && (
          <div className={`mt-4 p-4 rounded-xl text-sm flex items-center gap-3 ${
            actionFeedback.status === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {actionFeedback.status === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span>{actionFeedback.message}</span>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {pendingReports.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-700">No hay alertas ni incidencias pendientes de resolución.</p>
              <p className="text-xs text-slate-400 mt-1">Todas las solicitudes de tutores han sido atendidas.</p>
            </div>
          ) : (
            pendingReports.map((report) => {
              const session = sessions.find(s => s.id === report.sessionId);
              const tutor = allUsers.find(u => u.id === report.tutorId);

              return (
                <div key={report.id} className="bg-rose-50/40 border border-rose-200 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-xs uppercase tracking-wider">
                        {report.requestType === 'reasignar_tutor' ? 'Sustitución de Tutor' : 'Cambio de Horario'}
                      </span>
                      <span className="text-xs text-slate-400">• {new Date(report.createdAt).toLocaleDateString('es-CL')}</span>
                    </div>
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                      ● Requiere Acción
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-base">
                      {session?.title || 'Sesión no especificada'}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Fecha: <strong>{session?.date}</strong> | Bloque: <strong>{session?.timeSlot}</strong> | Tutor actual: <strong>{tutor?.name || 'Tutor'}</strong>
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-rose-100 text-xs text-slate-700">
                    <strong>Motivo del Reporte:</strong> {report.description}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                    <select
                      value={selectedTutorForReassign[report.id] || ''}
                      onChange={(e) => setSelectedTutorForReassign({ ...selectedTutorForReassign, [report.id]: e.target.value })}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-[#3a9ad9]"
                    >
                      <option value="">-- Seleccionar Nuevo Tutor Sustituto --</option>
                      {tutores.filter(t => t.id !== report.tutorId).map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.career || 'Tutor'})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleResolveReassignment(report)}
                      className="px-4 py-2 bg-[#092c4c] text-white rounded-xl text-xs font-bold hover:bg-[#0c3c66] transition flex items-center justify-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Confirmar Reasignación
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
