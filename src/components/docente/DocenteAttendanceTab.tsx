import React, { useState, useMemo, useEffect } from 'react';
import { Session, User } from '../../types';
import { 
  CheckSquare, 
  Calendar, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Send, 
  AlertTriangle, 
  QrCode, 
  UserPlus, 
  Search, 
  Trash2, 
  X, 
  Plus, 
  Check, 
  GraduationCap 
} from 'lucide-react';
import { getDynamicPresetDates, triggerNotification, saveSessions } from '../../data';
import { sessionsApi } from '../../services/api';
import { getSocket } from '../../services/socket';
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

  // Sincronización en tiempo real de la lista de asistencia vía WebSockets
  useEffect(() => {
    const socket = getSocket();
    const handleSessionsChanged = (payload: any) => {
      if (payload?.session && payload.action === 'update') {
        setSessions(prev => {
          const updated = prev.map(s => s.id === payload.session.id ? payload.session : s);
          saveSessions(updated);
          return updated;
        });
        if (selectedQRModalSession && selectedQRModalSession.id === payload.session.id) {
          setSelectedQRModalSession(payload.session);
        }
      } else if (payload?.session && payload.action === 'create') {
        setSessions(prev => {
          const updated = [payload.session, ...prev.filter(s => s.id !== payload.session.id)];
          saveSessions(updated);
          return updated;
        });
      } else if (payload?.sessionId && payload.action === 'delete') {
        setSessions(prev => {
          const updated = prev.filter(s => s.id !== payload.sessionId);
          saveSessions(updated);
          return updated;
        });
      } else {
        onReload();
      }
    };

    socket.on('sessions:changed', handleSessionsChanged);
    return () => {
      socket.off('sessions:changed', handleSessionsChanged);
    };
  }, [selectedQRModalSession, setSessions, onReload]);

  // Estado para agregar estudiantes manualmente a una sesión
  const [addingStudentSessionId, setAddingStudentSessionId] = useState<string | null>(null);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [initialStatusToAdd, setInitialStatusToAdd] = useState<'presente' | 'pendiente'>('presente');

  const dailySessions = sessions.filter(s => s.date === selectedDate);

  // Lista general de estudiantes registrados en el sistema
  const allStudents = useMemo(() => {
    return allUsers.filter(u => u.role === 'alumno');
  }, [allUsers]);

  const handleMarkAttendance = async (sessionId: string, studentId: string, status: 'presente' | 'ausente') => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const newAttendance = { ...(session.attendance || {}), [studentId]: status };
    const updatedSessions = sessions.map(s => s.id === sessionId ? { ...s, attendance: newAttendance, isCompleted: true } : s);
    setSessions(updatedSessions);

    try {
      await sessionsApi.updateSession(sessionId, { attendance: newAttendance, isCompleted: true });

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

  // Función para agregar un estudiante manualmente a la sesión
  const handleAddStudentToSession = async (sessionId: string) => {
    const studentId = selectedStudentToAdd;
    const initialStatus = initialStatusToAdd;
    if (!studentId) return;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    if ((session.studentIds || []).includes(studentId)) {
      setAttendanceFeedback('El estudiante ya se encuentra en la lista de esta sesión.');
      return;
    }

    const newStudentIds = [...(session.studentIds || []), studentId];
    const newAttendance: Record<string, 'presente' | 'ausente' | 'pendiente'> = { 
      ...(session.attendance || {}), 
      [studentId]: initialStatus 
    };

    const updatedSessions = sessions.map(s => s.id === sessionId ? { ...s, studentIds: newStudentIds, attendance: newAttendance } : s);
    setSessions(updatedSessions);

    try {
      await sessionsApi.updateSession(sessionId, {
        studentIds: newStudentIds,
        attendance: newAttendance
      });

      const studentObj = allUsers.find(u => u.id === studentId);
      setAttendanceFeedback(`¡${studentObj?.name || 'Estudiante'} agregado exitosamente a la lista con estado "${initialStatus}"!`);
      setTimeout(() => setAttendanceFeedback(null), 4000);
      setAddingStudentSessionId(null);
      setSelectedStudentToAdd('');
      setStudentSearchQuery('');
    } catch (err: any) {
      console.warn('Error al agregar estudiante manualmente:', err);
      setAttendanceFeedback('Error al guardar en el servidor.');
    }
  };

  // Función para remover un estudiante de la lista de asistencia
  const handleRemoveStudentFromSession = async (sessionId: string, studentId: string) => {
    const studentObj = allUsers.find(u => u.id === studentId);
    if (!confirm(`¿Estás seguro de remover a ${studentObj?.name || 'este estudiante'} de la lista de esta sesión?`)) return;

    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const newStudentIds = (session.studentIds || []).filter(id => id !== studentId);
    const newAttendance = { ...(session.attendance || {}) };
    delete newAttendance[studentId];

    const updatedSessions = sessions.map(s => s.id === sessionId ? { ...s, studentIds: newStudentIds, attendance: newAttendance } : s);
    setSessions(updatedSessions);

    try {
      await sessionsApi.updateSession(sessionId, {
        studentIds: newStudentIds,
        attendance: newAttendance
      });
      setAttendanceFeedback(`Estudiante ${studentObj?.name || ''} removido de la lista.`);
      setTimeout(() => setAttendanceFeedback(null), 3000);
    } catch (err) {
      console.warn('Error al remover estudiante:', err);
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
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (addingStudentSessionId === sess.id) {
                            setAddingStudentSessionId(null);
                            setSelectedStudentToAdd('');
                            setStudentSearchQuery('');
                          } else {
                            setAddingStudentSessionId(sess.id);
                            setSelectedStudentToAdd('');
                            setStudentSearchQuery('');
                            setInitialStatusToAdd('presente');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                          addingStudentSessionId === sess.id
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        title="Agregar manualmente un estudiante a esta sesión"
                      >
                        {addingStudentSessionId === sess.id ? (
                          <>
                            <X className="w-3.5 h-3.5" />
                            <span>Cerrar</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ Agregar Estudiante</span>
                          </>
                        )}
                      </button>
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

                  {/* Panel para agregar estudiante manualmente */}
                  {addingStudentSessionId === sess.id && (
                    <div className="bg-white border-2 border-dashed border-emerald-300 rounded-xl p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4 text-emerald-600" />
                          Inscribir Alumno a esta Sesión
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {allStudents.filter(st => !(sess.studentIds || []).includes(st.id)).length} estudiantes disponibles en el sistema
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Buscador y selector */}
                        <div className="sm:col-span-6 space-y-1.5">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Buscar por nombre, RUT o carrera..."
                              value={studentSearchQuery}
                              onChange={(e) => setStudentSearchQuery(e.target.value)}
                              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <select
                            value={selectedStudentToAdd}
                            onChange={(e) => setSelectedStudentToAdd(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">-- Seleccionar Estudiante ({
                              allStudents
                                .filter(st => !(sess.studentIds || []).includes(st.id))
                                .filter(st => {
                                  if (!studentSearchQuery) return true;
                                  const q = studentSearchQuery.toLowerCase();
                                  return (
                                    st.name?.toLowerCase().includes(q) ||
                                    st.rut?.toLowerCase().includes(q) ||
                                    st.career?.toLowerCase().includes(q) ||
                                    st.email?.toLowerCase().includes(q)
                                  );
                                }).length
                            } disponibles) --</option>
                            {allStudents
                              .filter(st => !(sess.studentIds || []).includes(st.id))
                              .filter(st => {
                                if (!studentSearchQuery) return true;
                                const q = studentSearchQuery.toLowerCase();
                                return (
                                  st.name?.toLowerCase().includes(q) ||
                                  st.rut?.toLowerCase().includes(q) ||
                                  st.career?.toLowerCase().includes(q) ||
                                  st.email?.toLowerCase().includes(q)
                                );
                              })
                              .map(st => (
                                <option key={st.id} value={st.id}>
                                  {st.name} {st.rut ? `(${st.rut})` : ''} - {st.career || 'Estudiante'}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Estado inicial */}
                        <div className="sm:col-span-3">
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Estado de Asistencia</label>
                          <select
                            value={initialStatusToAdd}
                            onChange={(e) => setInitialStatusToAdd(e.target.value as 'presente' | 'pendiente' | 'ausente')}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="presente">✓ Presente (Registrado ahora)</option>
                            <option value="pendiente">● Pendiente de marcar</option>
                            <option value="ausente">✕ Ausente</option>
                          </select>
                        </div>

                        {/* Botón de confirmar */}
                        <div className="sm:col-span-3 flex items-end">
                          <button
                            type="button"
                            disabled={!selectedStudentToAdd}
                            onClick={() => handleAddStudentToSession(sess.id)}
                            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Inscribir en Lista</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {studentIds.length === 0 ? (
                    <div className="text-xs text-slate-400 italic bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span>No hay alumnos inscritos aún en este bloque.</span>
                      <button
                        onClick={() => {
                          setAddingStudentSessionId(sess.id);
                          setSelectedStudentToAdd('');
                          setStudentSearchQuery('');
                          setInitialStatusToAdd('presente');
                        }}
                        className="text-emerald-700 font-bold hover:underline not-italic flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Agregar el primer alumno
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700 bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <thead className="bg-slate-100 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-4">Estudiante</th>
                            <th className="py-2.5 px-3">RUT</th>
                            <th className="py-2.5 px-3">Carrera</th>
                            <th className="py-2.5 px-3">Estado Actual</th>
                            <th className="py-2.5 px-4 text-center">Marcar Asistencia</th>
                            <th className="py-2.5 px-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentIds.map(stId => {
                            const student = allUsers.find(u => u.id === stId);
                            const currentStatus = sess.attendance?.[stId] || 'pendiente';

                            return (
                              <tr key={stId} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-4 font-semibold text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                                      {student?.name?.charAt(0) || 'E'}
                                    </div>
                                    <span>{student?.name || stId}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-500">{student?.rut || '-'}</td>
                                <td className="py-2.5 px-3 text-slate-500">{student?.career || '-'}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    currentStatus === 'presente' ? 'bg-emerald-100 text-emerald-800' :
                                    currentStatus === 'ausente' ? 'bg-rose-100 text-rose-800' :
                                    'bg-amber-100 text-amber-800'
                                  }`}>
                                    {currentStatus.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleMarkAttendance(sess.id, stId, 'presente')}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                        currentStatus === 'presente'
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      }`}
                                    >
                                      Presente
                                    </button>
                                    <button
                                      onClick={() => handleMarkAttendance(sess.id, stId, 'ausente')}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                        currentStatus === 'ausente'
                                          ? 'bg-rose-600 text-white shadow-xs'
                                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                      }`}
                                    >
                                      Ausente
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    onClick={() => handleRemoveStudentFromSession(sess.id, stId)}
                                    title="Remover de la lista"
                                    className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
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
