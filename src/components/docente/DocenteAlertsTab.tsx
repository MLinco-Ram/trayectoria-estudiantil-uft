import React, { useState } from 'react';
import { IssueReport, Session, User, UserAvailability } from '../../types';
import { AlertTriangle, CheckCircle2, UserCheck, GraduationCap, Check, Clock } from 'lucide-react';
import { triggerNotification, getTodayDateStr, TIME_SLOTS } from '../../data';
import { sessionsApi, reportsApi } from '../../services/api';
import { findTutorAvailability, getDayNameFromDate, getTutorSlotStatus, TutorWeeklySchedule } from './tutorAvailability';

interface DocenteAlertsTabProps {
  reports: IssueReport[];
  setReports: React.Dispatch<React.SetStateAction<IssueReport[]>>;
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  allUsers: User[];
  allAvailabilities?: UserAvailability[];
  onReload: () => void;
}

interface ResolutionDraft {
  tutorId?: string; // '' = mantener al tutor actual de la sesión
  date?: string;
  timeSlot?: string;
}

export const DocenteAlertsTab: React.FC<DocenteAlertsTabProps> = ({
  reports,
  setReports,
  sessions,
  setSessions,
  allUsers,
  allAvailabilities = [],
  onReload,
}) => {
  const [drafts, setDrafts] = useState<{ [reportId: string]: ResolutionDraft }>({});
  // Combinación tutor/fecha/bloque que el docente aceptó confirmar pese a la advertencia
  const [acknowledgedWarning, setAcknowledgedWarning] = useState<{ [reportId: string]: string }>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'pendiente' | 'resuelto' | 'all'>('pendiente');
  const [actionFeedback, setActionFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  const tutores = allUsers.filter(u => u && (u.role === 'tutor' || (Array.isArray(u.roles) && u.roles.includes('tutor'))));

  const updateDraft = (reportId: string, patch: ResolutionDraft) => {
    setDrafts(prev => ({ ...prev, [reportId]: { ...prev[reportId], ...patch } }));
  };

  // Valores efectivos del formulario de resolución (borrador del docente o sugerencias del reporte)
  const getResolution = (report: IssueReport, session?: Session) => {
    const draft = drafts[report.id] || {};
    const defaultTutorId = report.requestType === 'reasignar_tutor' ? (report.suggestedTutorId || '') : '';
    const defaultSlot =
      report.requestType === 'reasignar_horario' && report.proposedTime && TIME_SLOTS.includes(report.proposedTime)
        ? report.proposedTime
        : session?.timeSlot || '';
    return {
      tutorId: draft.tutorId ?? defaultTutorId,
      date: draft.date ?? (session?.date || ''),
      timeSlot: draft.timeSlot ?? defaultSlot,
    };
  };

  const markReportResolved = async (report: IssueReport, resolutionNote: string) => {
    const patch = { status: 'resuelto' as const, resolvedAt: new Date().toISOString(), resolutionNote };
    await reportsApi.updateReport(report.id, patch);
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, ...patch } : r));
  };

  const finishAction = (message: string) => {
    setActionFeedback({ status: 'success', message });
    setTimeout(() => {
      setActionFeedback(null);
      onReload();
    }, 2500);
  };

  const handleResolve = async (report: IssueReport) => {
    const session = sessions.find(s => s.id === report.sessionId);
    if (!session) return;

    const { tutorId, date, timeSlot } = getResolution(report, session);
    const newTutorId = tutorId || session.tutorId || '';
    const tutorChanged = newTutorId !== (session.tutorId || '');
    const scheduleChanged = date !== session.date || timeSlot !== session.timeSlot;

    if (!date || !timeSlot) {
      setActionFeedback({ status: 'error', message: 'Por favor indica la fecha y el bloque horario de la sesión.' });
      return;
    }
    if (!tutorChanged && !scheduleChanged) {
      setActionFeedback({
        status: 'error',
        message: 'No hay cambios que aplicar: selecciona un tutor sustituto o un nuevo horario, o usa "Cerrar sin cambios".'
      });
      return;
    }

    // Si el tutor no está disponible o tiene tope, se exige una segunda confirmación explícita
    if (newTutorId) {
      const status = getTutorSlotStatus(allAvailabilities, sessions, newTutorId, date, timeSlot, session.id);
      const warningKey = `${newTutorId}|${date}|${timeSlot}`;
      if ((status.conflict || !status.availableForSlot) && acknowledgedWarning[report.id] !== warningKey) {
        setAcknowledgedWarning(prev => ({ ...prev, [report.id]: warningKey }));
        return;
      }
    }

    setProcessingId(report.id);
    setActionFeedback(null);

    try {
      const sessionPatch: Partial<Session> = {};
      if (tutorChanged) sessionPatch.tutorId = newTutorId;
      if (scheduleChanged) {
        sessionPatch.date = date;
        sessionPatch.timeSlot = timeSlot;
      }
      await sessionsApi.updateSession(session.id, sessionPatch);
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, ...sessionPatch } : s));

      const newTutor = allUsers.find(u => u.id === newTutorId);
      const previousTutor = allUsers.find(u => u.id === session.tutorId);
      const scheduleText = `${date} (${getDayNameFromDate(date)}), bloque ${timeSlot}`;

      if (tutorChanged && newTutor?.email) {
        triggerNotification(
          newTutor.email,
          newTutor.name,
          `Asignación de Tutoría Sustituta: "${session.title}"`,
          `Se te ha asignado como tutor sustituto en la sesión "${session.title}" programada para el día ${scheduleText}. Ingresa a la plataforma para revisar los detalles.`
        );
      }
      if (tutorChanged && previousTutor?.email) {
        triggerNotification(
          previousTutor.email,
          previousTutor.name,
          `Tu inconveniente fue resuelto: "${session.title}"`,
          `La coordinación docente reasignó la sesión "${session.title}" del día ${scheduleText} a ${newTutor?.name || 'otro tutor'}. Ya no figura entre tus tutorías asignadas.`
        );
      }
      if (scheduleChanged) {
        if (!tutorChanged && newTutor?.email) {
          triggerNotification(
            newTutor.email,
            newTutor.name,
            `Cambio de horario aprobado: "${session.title}"`,
            `La coordinación docente reprogramó la sesión "${session.title}". Nuevo horario: ${scheduleText}.`
          );
        }
        allUsers
          .filter(u => u && u.email && (session.studentIds || []).includes(u.id))
          .forEach(student => {
            triggerNotification(
              student.email,
              student.name,
              `Cambio de horario en tu tutoría: "${session.title}"`,
              `La sesión "${session.title}" fue reprogramada. Nuevo horario: ${scheduleText}. Ingresa a la plataforma para revisar los detalles.`
            );
          });
      }

      const noteParts = [];
      if (tutorChanged) noteParts.push(`Tutor reasignado a ${newTutor?.name || newTutorId}`);
      if (scheduleChanged) noteParts.push(`Sesión reprogramada para ${scheduleText}`);
      await markReportResolved(report, noteParts.join('. '));

      finishAction(`¡Caso resuelto! ${noteParts.join('. ')}. Se notificó a los involucrados.`);
    } catch (err: any) {
      setActionFeedback({
        status: 'error',
        message: err.message || 'Error al procesar la resolución del caso.'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCloseWithoutChanges = async (report: IssueReport) => {
    setProcessingId(report.id);
    setActionFeedback(null);
    try {
      await markReportResolved(report, 'Cerrado por coordinación sin cambios en la sesión');
      finishAction('Caso cerrado sin modificar la sesión.');
    } catch (err: any) {
      setActionFeedback({ status: 'error', message: err.message || 'Error al cerrar el caso.' });
    } finally {
      setProcessingId(null);
    }
  };

  const byNewest = (a: IssueReport, b: IssueReport) => (b.createdAt || '').localeCompare(a.createdAt || '');
  const pendingReports = reports.filter(r => r.status === 'pendiente').sort(byNewest);
  const resolvedReports = reports
    .filter(r => r.status === 'resuelto')
    .sort((a, b) => (b.resolvedAt || b.createdAt || '').localeCompare(a.resolvedAt || a.createdAt || ''));
  const showPending = filterStatus !== 'resuelto';
  const showResolved = filterStatus !== 'pendiente';

  const requestTypeLabel = (type: IssueReport['requestType']) =>
    type === 'reasignar_tutor' ? 'Sustitución de Tutor' : type === 'reasignar_horario' ? 'Cambio de Horario' : 'Otro Inconveniente';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div id="docente-alerts-header" className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Incidencias y Alertas Reportadas por Tutores
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Topes de horario imprevistos, solicitudes de cambio de tutor y reasignación de módulos.
            </p>
          </div>
          {/* Filtro por estado */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setFilterStatus('pendiente')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filterStatus === 'pendiente' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendientes ({pendingReports.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('resuelto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filterStatus === 'resuelto' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Resueltos ({resolvedReports.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filterStatus === 'all' ? 'bg-[#092c4c] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({reports.length})
            </button>
          </div>
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

        <div id="docente-alerts-list" className="mt-6 space-y-4">
          {showPending && (pendingReports.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-700">No hay alertas ni incidencias pendientes de resolución.</p>
              <p className="text-xs text-slate-400 mt-1">Todas las solicitudes de tutores han sido atendidas.</p>
            </div>
          ) : (
            pendingReports.map((report) => {
              const session = sessions.find(s => s.id === report.sessionId);
              const reportingTutor = allUsers.find(u => u.id === report.tutorId);
              const currentTutor = allUsers.find(u => u.id === session?.tutorId) || reportingTutor;
              const isProcessing = processingId === report.id;

              const resolution = getResolution(report, session);
              const dayName = getDayNameFromDate(resolution.date);
              // Todos los tutores menos el que ya está a cargo (ese se cubre con la opción "Mantener a...")
              const candidates = tutores.filter(t => t.id !== (session?.tutorId || report.tutorId));
              const statusFor = (tutorId: string) =>
                getTutorSlotStatus(allAvailabilities, sessions, tutorId, resolution.date, resolution.timeSlot, session?.id);

              const sortedCandidates = [...candidates].sort((a, b) => {
                const rank = (id: string) => {
                  const st = statusFor(id);
                  if (st.conflict) return 3;
                  if (st.availableForSlot) return 0;
                  if (st.availableForDay) return 1;
                  return 2;
                };
                return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name);
              });
              const freeCandidates = sortedCandidates.filter(t => {
                const st = statusFor(t.id);
                return st.availableForSlot && !st.conflict;
              });

              // Tutor que quedaría a cargo con la resolución actual
              const effectiveTutorId = resolution.tutorId || session?.tutorId || '';
              const effectiveTutor = allUsers.find(u => u.id === effectiveTutorId);
              const effectiveStatus = effectiveTutorId ? statusFor(effectiveTutorId) : null;
              const needsWarning = !!effectiveStatus && (!!effectiveStatus.conflict || !effectiveStatus.availableForSlot);
              const warningAcknowledged =
                acknowledgedWarning[report.id] === `${effectiveTutorId}|${resolution.date}|${resolution.timeSlot}`;

              return (
                <div key={report.id} className="bg-rose-50/40 border border-rose-200 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-bold text-xs uppercase tracking-wider">
                        {requestTypeLabel(report.requestType)}
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
                    {session ? (
                      <p className="text-xs text-slate-600 mt-0.5">
                        Fecha: <strong>{session.date} ({getDayNameFromDate(session.date)})</strong> | Bloque: <strong>{session.timeSlot}</strong> | Tutor actual: <strong>{currentTutor?.name || 'Sin tutor'}</strong>
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 mt-0.5">
                        La sesión asociada a este reporte ya no existe. Reportado por: <strong>{reportingTutor?.name || 'Tutor'}</strong>
                      </p>
                    )}
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-rose-100 text-xs text-slate-700 space-y-1.5">
                    <p><strong>Motivo del Reporte:</strong> {report.description}</p>
                    {report.proposedTime && (
                      <p className="text-sky-700 font-medium">
                        ⏰ <strong>Horario propuesto:</strong> {report.proposedTime}
                      </p>
                    )}
                    {report.suggestedTutorName && (
                      <div className="mt-2 p-2.5 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between text-teal-900">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">🧑‍🏫 Tutor sugerido por el tutor:</span>
                          <span className="font-extrabold text-teal-950 underline">{report.suggestedTutorName}</span>
                        </div>
                        {report.suggestedTutorId && resolution.tutorId !== report.suggestedTutorId && (
                          <button
                            type="button"
                            onClick={() => updateDraft(report.id, { tutorId: report.suggestedTutorId })}
                            className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-[11px] font-bold cursor-pointer transition shadow-2xs"
                          >
                            Usar Sugerencia
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {session && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                      <span className="text-[11px] font-bold text-slate-800 uppercase block">Resolución del caso</span>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Tutor a cargo</label>
                          <select
                            value={resolution.tutorId}
                            onChange={(e) => updateDraft(report.id, { tutorId: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-[#3a9ad9]"
                          >
                            <option value="">Mantener a {currentTutor?.name || 'tutor actual'}</option>
                            {sortedCandidates.map(t => {
                              const st = statusFor(t.id);
                              const label = st.conflict
                                ? '⛔ Tope con otra sesión'
                                : st.availableForSlot
                                ? '✅ Disponible'
                                : st.availableForDay
                                ? `⏰ Otros bloques el ${dayName}`
                                : st.hasAnyAvail
                                ? `⚪ Sin horario el ${dayName}`
                                : '⚪ Sin horario cargado';
                              return (
                                <option key={t.id} value={t.id}>
                                  {t.name} • {label}{report.suggestedTutorId === t.id ? ' ★ Sugerido' : ''}{report.tutorId === t.id ? ' (reportó el inconveniente)' : ''}
                                </option>
                              );
                            })}
                          </select>
                          {candidates.length === 0 && (
                            <p className="text-[10px] text-amber-700 mt-1">
                              No hay otros tutores registrados para sustituir. Agrega tutores en "Gestión Tutores".
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Fecha {dayName ? `(${dayName})` : ''}</label>
                          <input
                            type="date"
                            value={resolution.date}
                            min={getTodayDateStr()}
                            onChange={(e) => updateDraft(report.id, { date: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-[#3a9ad9]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Bloque horario</label>
                          <select
                            value={resolution.timeSlot}
                            onChange={(e) => updateDraft(report.id, { timeSlot: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-700 font-mono font-semibold focus:ring-2 focus:ring-[#3a9ad9]"
                          >
                            {!TIME_SLOTS.includes(resolution.timeSlot) && resolution.timeSlot && (
                              <option value={resolution.timeSlot}>{resolution.timeSlot}</option>
                            )}
                            {TIME_SLOTS.map(slot => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Selección rápida de sustitutos libres en la fecha y bloque elegidos */}
                      {freeCandidates.length > 0 && (
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                          <span className="text-[11px] font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Tutores disponibles el {dayName} a las {resolution.timeSlot}:</span>
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {freeCandidates.map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => updateDraft(report.id, { tutorId: t.id })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                  resolution.tutorId === t.id
                                    ? 'bg-emerald-700 text-white shadow-xs'
                                    : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                                }`}
                              >
                                <GraduationCap className="w-3.5 h-3.5" />
                                <span>{t.name}</span>
                                {resolution.tutorId === t.id && <Check className="w-3.5 h-3.5" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Disponibilidad real del tutor que quedaría a cargo */}
                      {effectiveTutor && effectiveStatus && (
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                          <div className={`p-2.5 rounded-lg border text-[11px] font-semibold flex items-start gap-2 ${
                            effectiveStatus.conflict
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : effectiveStatus.availableForSlot
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}>
                            {effectiveStatus.conflict || !effectiveStatus.availableForSlot
                              ? <AlertTriangle className="w-4 h-4 shrink-0" />
                              : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                            <span>
                              {effectiveStatus.conflict
                                ? `${effectiveTutor.name} ya tiene la sesión "${effectiveStatus.conflict.title}" el ${resolution.date} en el bloque ${resolution.timeSlot}.`
                                : effectiveStatus.availableForSlot
                                ? `${effectiveTutor.name} declaró disponibilidad el ${dayName} en el bloque ${resolution.timeSlot} y no tiene otra sesión en ese horario.`
                                : effectiveStatus.availableForDay
                                ? `${effectiveTutor.name} no declaró el bloque ${resolution.timeSlot} el ${dayName}. Ese día tiene disponibles: ${effectiveStatus.slots.join(', ')}.`
                                : effectiveStatus.hasAnyAvail
                                ? `${effectiveTutor.name} no declaró disponibilidad para el día ${dayName}.`
                                : `${effectiveTutor.name} no ha cargado su horario semanal, por lo que no se puede verificar su disponibilidad.`}
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#3a9ad9]" />
                              Horario semanal declarado por {effectiveTutor.name}:
                            </span>
                            <TutorWeeklySchedule
                              availability={findTutorAvailability(allAvailabilities, effectiveTutorId)}
                              highlightDay={dayName}
                              highlightSlot={resolution.timeSlot}
                            />
                          </div>
                        </div>
                      )}

                      {needsWarning && warningAcknowledged && (
                        <p className="text-[11px] font-semibold text-amber-800">
                          ⚠️ Revisa la advertencia de disponibilidad. Si igualmente deseas aplicar esta resolución, presiona "Confirmar de todos modos".
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCloseWithoutChanges(report)}
                      disabled={isProcessing}
                      className="px-4 py-2 border border-slate-300 bg-white text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                    >
                      Cerrar sin cambios
                    </button>
                    {session && (
                      <button
                        type="button"
                        onClick={() => handleResolve(report)}
                        disabled={isProcessing}
                        className={`px-4 py-2 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 ${
                          needsWarning && warningAcknowledged ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#092c4c] hover:bg-[#0c3c66]'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {isProcessing ? 'Guardando...' : needsWarning && warningAcknowledged ? 'Confirmar de todos modos' : 'Confirmar Resolución'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ))}

          {showResolved && (resolvedReports.length === 0 ? (
            filterStatus === 'resuelto' && (
              <div className="py-12 text-center text-slate-400">
                <p className="text-sm font-semibold text-slate-700">Aún no hay alertas resueltas.</p>
              </div>
            )
          ) : (
            resolvedReports.map((report) => {
              const session = sessions.find(s => s.id === report.sessionId);
              const reportingTutor = allUsers.find(u => u.id === report.tutorId);

              return (
                <div key={report.id} className="bg-slate-50/70 border border-slate-200 rounded-2xl p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider">
                        {requestTypeLabel(report.requestType)}
                      </span>
                      <span className="text-xs text-slate-400">• {new Date(report.createdAt).toLocaleDateString('es-CL')}</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 self-start sm:self-auto">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resuelto{report.resolvedAt ? ` el ${new Date(report.resolvedAt).toLocaleDateString('es-CL')}` : ''}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 text-base">
                      {session?.title || 'Sesión ya no disponible'}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Reportado por: <strong>{reportingTutor?.name || 'Tutor'}</strong>
                      {session && (
                        <> | Sesión hoy: <strong>{session.date} ({getDayNameFromDate(session.date)})</strong>, bloque <strong>{session.timeSlot}</strong></>
                      )}
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
                    <p><strong>Motivo del Reporte:</strong> {report.description}</p>
                    <p className="text-emerald-800">
                      <strong>Resolución:</strong> {report.resolutionNote || 'Sin detalle registrado.'}
                    </p>
                  </div>
                </div>
              );
            })
          ))}
        </div>
      </div>
    </div>
  );
};
