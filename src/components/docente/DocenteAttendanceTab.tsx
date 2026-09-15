import React, { useState } from 'react';
import { Session, User } from '../../types';
import { CheckSquare, Calendar, Users, CheckCircle2, XCircle, Clock, Send, AlertTriangle, QrCode } from 'lucide-react';
import { getDynamicPresetDates, triggerNotification } from '../../data';
import { sessionsApi } from '../../services/api';
import { SessionQRModal } from '../common/SessionQRModal';

interface DocenteAttendanceTabProps {
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  allUsers: User[];
  onReload: () => void;
}

export const DocenteAttendanceTab: React.FC<DocenteAttendanceTabProps> = ({
  sessions,
  setSessions,
  allUsers,
  onReload,
}) => {
  const presetDates = getDynamicPresetDates(6);
  const [selectedDate, setSelectedDate] = useState<string>(presetDates[0]);
  const [attendanceFeedback, setAttendanceFeedback] = useState<string | null>(null);
  const [selectedQRModalSession, setSelectedQRModalSession] = useState<Session | null>(null);

  const dailySessions = sessions.filter(s => s.date === selectedDate);

  const handleMarkAttendance = async (sessionId: string, studentId: string, status: 'presente' | 'ausente') => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const newAttendance = { ...(session.attendance || {}), [studentId]: status };
    const updatedSessions = sessions.map(s => s.id === sessionId ? { ...s, attendance: newAttendance } : s);
    setSessions(updatedSessions);

    try {
      await sessionsApi.updateSession(sessionId, { attendance: newAttendance });

      // Si se marca ausente, enviar correo de alerta de inasistencia
      if (status === 'ausente') {
        const student = allUsers.find(u => u.id === studentId);
        if (student && student.email) {
          triggerNotification(
            student.email,
            student.name,
            `Aviso de Inasistencia: "${session.title}"`,
            `Estimado/a ${student.name}, registramos tu inasistencia en la sesión de tutoría "${session.title}" de hoy (${session.date} - ${session.timeSlot}). Si tuviste algún inconveniente de fuerza mayor, por favor comunícate con la coordinación.`
          );
        }
      }

      setAttendanceFeedback(`Asistencia registrada para el estudiante.`);
      setTimeout(() => setAttendanceFeedback(null), 3000);
    } catch (err: any) {
      console.warn('Guardado local de asistencia:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#3a9ad9]" />
              Pasar Lista y Registro de Asistencia
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Marca la presencia de los estudiantes inscritos. Al marcar ausente se envía alerta por correo.
            </p>
          </div>

          {/* Selector de Fechas Dinámicas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
            {presetDates.map((dateStr, idx) => (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedDate === dateStr 
                    ? 'bg-[#092c4c] text-white shadow-sm' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {idx === 0 ? 'Hoy' : idx === 1 ? 'Mañana' : dateStr}
              </button>
            ))}
          </div>
        </div>

        {attendanceFeedback && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{attendanceFeedback}</span>
          </div>
        )}

        <div className="mt-6 space-y-6">
          {dailySessions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No hay sesiones programadas para esta fecha ({selectedDate}).</p>
            </div>
          ) : (
            dailySessions.map((sess) => {
              const tutor = allUsers.find(u => u.id === sess.tutorId);
              const studentIds = sess.studentIds || [];
              const allMarked = studentIds.length > 0 && studentIds.every(id => sess.attendance?.[id] && sess.attendance[id] !== 'pendiente');

              return (
                <div key={sess.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">{sess.title}</h3>
                      <p className="text-xs text-slate-500">
                        {sess.timeSlot} • {sess.location} • Tutor: <strong>{tutor?.name || 'Coordinación'}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedQRModalSession(sess)}
                        className="px-3 py-1.5 rounded-xl bg-[#092c4c] hover:bg-[#153a5c] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="Mostrar código QR de asistencia para escanear con celular"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#3a9ad9]" />
                        <span>Ver QR Asistencia</span>
                      </button>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        allMarked 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {allMarked ? '✓ Asistencia Lista' : '● Pendiente'}
                      </span>
                    </div>
                  </div>

                  {studentIds.length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-white p-3 rounded-xl border border-slate-200">
                      No hay alumnos inscritos aún en este bloque.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700 bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <thead className="bg-slate-100 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-4">Estudiante</th>
                            <th className="py-2.5 px-3">RUT</th>
                            <th className="py-2.5 px-3">Estado Actual</th>
                            <th className="py-2.5 px-4 text-right">Marcar Asistencia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentIds.map(stId => {
                            const student = allUsers.find(u => u.id === stId);
                            const currentStatus = sess.attendance?.[stId] || 'pendiente';

                            return (
                              <tr key={stId} className="hover:bg-slate-50">
                                <td className="py-2.5 px-4 font-semibold">{student?.name || stId}</td>
                                <td className="py-2.5 px-3 font-mono">{student?.rut || '-'}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    currentStatus === 'presente' ? 'bg-emerald-100 text-emerald-800' :
                                    currentStatus === 'ausente' ? 'bg-rose-100 text-rose-800' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {currentStatus.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleMarkAttendance(sess.id, stId, 'presente')}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                        currentStatus === 'presente'
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      }`}
                                    >
                                      Presente
                                    </button>
                                    <button
                                      onClick={() => handleMarkAttendance(sess.id, stId, 'ausente')}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                        currentStatus === 'ausente'
                                          ? 'bg-rose-600 text-white'
                                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                      }`}
                                    >
                                      Ausente
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal de Código QR Grande para escanear en clase */}
      <SessionQRModal
        session={selectedQRModalSession}
        onClose={() => setSelectedQRModalSession(null)}
        allUsers={allUsers}
      />
    </div>
  );
};
