import React, { useState, useMemo, useRef } from 'react';
import { Session, User } from '../../types';
import { 
  CheckSquare, 
  Calendar, 
  Users, 
  CheckCircle2, 
  Clock, 
  QrCode, 
  UserPlus, 
  Search, 
  Trash2, 
  X, 
  Plus, 
  Check, 
  GraduationCap,
  ShieldCheck,
  Filter
} from 'lucide-react';
import { getTodayDateStr, getRelativeDateStr, triggerNotification, saveSessions } from '../../data';
import { sessionsApi } from '../../services/api';

interface TutorAttendanceTabProps {
  user: User;
  effectiveUser: User;
  isLeadTutor: boolean;
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  allUsers: User[];
  assignedTutors: User[];
  onReload: () => void;
  onOpenQRModal: (session: Session) => void;
}

export const TutorAttendanceTab: React.FC<TutorAttendanceTabProps> = ({
  user,
  effectiveUser,
  isLeadTutor,
  sessions,
  setSessions,
  allUsers,
  assignedTutors,
  onReload,
  onOpenQRModal,
}) => {
  const datePickerRef = useRef<HTMLInputElement>(null);
  const todayStr = getTodayDateStr();
  const tomorrowStr = getRelativeDateStr(1);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(todayStr);
  const [selectedTutorFilter, setSelectedTutorFilter] = useState<string>('mine');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [attendanceFeedback, setAttendanceFeedback] = useState<string | null>(null);

  // Estado para agregar estudiantes manualmente a una sesión
  const [addingStudentSessionId, setAddingStudentSessionId] = useState<string | null>(null);
  const [selectedStudentToAdd, setSelectedStudentToAdd] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [initialStatusToAdd, setInitialStatusToAdd] = useState<'presente' | 'pendiente'>('presente');

  // Lista general de estudiantes registrados en el sistema
  const allStudents = useMemo(() => {
    return allUsers.filter(u => u && (u.role === 'alumno' || (Array.isArray(u.roles) && u.roles.includes('alumno'))));
  }, [allUsers]);

  // Sesiones filtradas según el rol y filtros seleccionados
  const filteredSessions = useMemo(() => {
    let list = sessions;

    // Filtro por tutor (propias vs tutores a cargo)
    if (!isLeadTutor || selectedTutorFilter === 'mine') {
      list = list.filter(s => s.tutorId === user.id || s.tutorId === effectiveUser.id);
    } else if (selectedTutorFilter === 'assigned') {
      const assignedIds = (effectiveUser.assignedTutorIds || []).length > 0
        ? effectiveUser.assignedTutorIds
        : assignedTutors.map(t => t.id);
      list = list.filter(s => s.tutorId && assignedIds.includes(s.tutorId));
    } else if (selectedTutorFilter !== 'all') {
      list = list.filter(s => s.tutorId === selectedTutorFilter);
    } else {
      // 'all' para lead tutor: propias + tutores a cargo
      const assignedIds = (effectiveUser.assignedTutorIds || []).length > 0
        ? effectiveUser.assignedTutorIds
        : assignedTutors.map(t => t.id);
      list = list.filter(s => s.tutorId === user.id || s.tutorId === effectiveUser.id || (s.tutorId && assignedIds.includes(s.tutorId)));
    }

    // Filtro por fecha
    if (selectedDateFilter !== 'all') {
      list = list.filter(s => s.date === selectedDateFilter);
    }

    // Filtro por búsqueda de texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => {
        const studentNames = (s.studentIds || []).map(id => allUsers.find(u => u.id === id)?.name || '').join(' ');
        const tutorObj = allUsers.find(u => u.id === s.tutorId);
        return (
          s.title.toLowerCase().includes(q) ||
          (s.subject && s.subject.toLowerCase().includes(q)) ||
          (s.location && s.location.toLowerCase().includes(q)) ||
          studentNames.toLowerCase().includes(q) ||
          (tutorObj && tutorObj.name.toLowerCase().includes(q))
        );
      });
    }

    // Ordenar por fecha descendente
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [sessions, isLeadTutor, selectedTutorFilter, selectedDateFilter, searchQuery, user.id, effectiveUser, assignedTutors, allUsers]);

  const handleMarkAttendance = async (sessionId: string, studentId: string, status: 'presente' | 'ausente') => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const currentStatus = session.attendance?.[studentId] || 'pendiente';
    const newStatus: 'presente' | 'ausente' | 'pendiente' = currentStatus === status ? 'pendiente' : status;

    const newAttendance = { ...(session.attendance || {}), [studentId]: newStatus };
    const updatedSessions = sessions.map(s => s.id === sessionId ? { ...s, attendance: newAttendance, isCompleted: true } : s);
    setSessions(updatedSessions);
    saveSessions(updatedSessions);

    try {
      await sessionsApi.updateSession(sessionId, { attendance: newAttendance, isCompleted: true });

      const student = allUsers.find(u => u.id === studentId);
      if (student && student.email) {
        if (newStatus === 'presente') {
          triggerNotification(
            student.email,
            student.name,
            `Encuesta de Satisfacción: "${session.title}"`,
            `Tu tutoría "${session.title}" del día ${session.date} ha finalizado. Por favor ingresa a la plataforma en tu Historial de Clases para responder la encuesta de satisfacción de 12 preguntas y evaluar tu experiencia.`
          );
        } else if (newStatus === 'ausente') {
          triggerNotification(
            student.email,
            student.name,
            `Aviso de Inasistencia: "${session.title}"`,
            `Registramos tu inasistencia en la sesión de tutoría "${session.title}" del día ${session.date}. Ingresa a la plataforma para revisar los detalles.`
          );
        }
      }

      setAttendanceFeedback(`Asistencia actualizada para ${student?.name || 'el estudiante'}.`);
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

    const updatedSessions = sessions.map(s => s.id === sessionId ? { ...s, studentIds: newStudentIds, attendance: newAttendance, isCompleted: true } : s);
    setSessions(updatedSessions);
    saveSessions(updatedSessions);

    try {
      await sessionsApi.updateSession(sessionId, {
        studentIds: newStudentIds,
        attendance: newAttendance,
        isCompleted: true
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
    saveSessions(updatedSessions);

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
    <div className="space-y-6 animate-fade-in" id="tutor-attendance-tab">
      {/* Tarjeta Principal de Cabecera */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 font-display">
              <CheckSquare className="w-5 h-5 text-[#3a9ad9]" />
              Pasar Lista y Control de Asistencia
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Registra la asistencia en tus tutorías en tiempo real o genera el código QR para escaneo estudiantil presencial.
            </p>
          </div>

          {/* Selector de Filtro de Tutor (exclusivo para Tutor de Tutores) */}
          {isLeadTutor && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Vista:</span>
              </span>
              <select
                value={selectedTutorFilter}
                onChange={(e) => setSelectedTutorFilter(e.target.value)}
                className="bg-indigo-50/70 border border-indigo-200 text-indigo-950 font-bold text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="mine">Mis Tutorías Asignadas</option>
                <option value="assigned">Tutores a Cargo ({assignedTutors.length})</option>
                <option value="all">Todas las Tutorías (Supervisión)</option>
                {assignedTutors.map(t => (
                  <option key={t.id} value={t.id}>Tutor: {t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Barra de Filtros: Hoy, Mañana, Calendario interactivo y Todas */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSelectedDateFilter(todayStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedDateFilter === todayStr 
                  ? 'bg-[#092c4c] text-white shadow-sm font-black' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Hoy</span>
              <span className="hidden sm:inline font-mono text-[10px] ml-1 opacity-80">({todayStr})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDateFilter(tomorrowStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedDateFilter === tomorrowStr 
                  ? 'bg-[#092c4c] text-white shadow-sm font-black' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Mañana</span>
              <span className="hidden sm:inline font-mono text-[10px] ml-1 opacity-80">({tomorrowStr})</span>
            </button>

            {/* Selector Calendario Interactivo */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                onClick={() => {
                  const input = datePickerRef.current;
                  if (!input) return;
                  try {
                    input.showPicker();
                  } catch {
                    input.focus();
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer border ${
                  selectedDateFilter !== 'all' && selectedDateFilter !== todayStr && selectedDateFilter !== tomorrowStr
                    ? 'bg-[#092c4c] text-white border-[#092c4c] shadow-sm font-black'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <Calendar className={`w-3.5 h-3.5 ${selectedDateFilter !== 'all' && selectedDateFilter !== todayStr && selectedDateFilter !== tomorrowStr ? 'text-[#3a9ad9]' : 'text-slate-500'}`} />
                <span>
                  {selectedDateFilter !== 'all' && selectedDateFilter !== todayStr && selectedDateFilter !== tomorrowStr 
                    ? selectedDateFilter 
                    : 'Elegir Día'}
                </span>
              </button>
              <input
                ref={datePickerRef}
                type="date"
                value={selectedDateFilter !== 'all' ? selectedDateFilter : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDateFilter(e.target.value);
                  }
                }}
                className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
                tabIndex={-1}
                title="Seleccionar un día en el calendario"
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedDateFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedDateFilter === 'all'
                  ? 'bg-[#092c4c] text-white shadow-sm font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas
            </button>
          </div>

          <div className="relative w-full md:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por sesión o alumno..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3a9ad9]"
            />
          </div>
        </div>

        {attendanceFeedback && (
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2 animate-fade-in shadow-2xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{attendanceFeedback}</span>
          </div>
        )}

        {/* Lista de Sesiones para Pasar Asistencia */}
        <div className="space-y-5 pt-2">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-2">
              <Calendar className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No hay tutorías para los filtros seleccionados.</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {selectedDateFilter !== 'all' 
                  ? `No tienes tutorías programadas para el día ${selectedDateFilter}. Selecciona "Todas las Fechas" para revisar otras sesiones.`
                  : 'Aún no tienes tutorías registradas en el sistema.'}
              </p>
            </div>
          ) : (
            filteredSessions.map((sess) => {
              const tutor = allUsers.find(u => u.id === sess.tutorId);
              const studentIds = sess.studentIds || [];
              const attendances = sess.attendance || {};
              let presentCount = 0;
              let absentCount = 0;
              let pendingCount = 0;

              studentIds.forEach(stId => {
                const st = attendances[stId] || 'pendiente';
                if (st === 'presente') presentCount++;
                else if (st === 'ausente') absentCount++;
                else pendingCount++;
              });

              const allMarked = studentIds.length > 0 && pendingCount === 0;

              return (
                <div key={sess.id} className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 hover:border-slate-300 transition-all shadow-2xs">
                  {/* Cabecera de la Sesión */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-slate-900">{sess.title}</h3>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 uppercase">
                          {sess.program === 'psicoeducativo' ? 'Psicoeducativo' : 'Tutoría Académica'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        📅 <strong>{sess.date}</strong> • ⏰ {sess.timeSlot} • 📍 {sess.location} • Tutor: <strong className="text-slate-800">{tutor?.name || 'Tutor Par'}</strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      {/* Botón + Agregar Estudiante */}
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
                        title="Inscribir manualmente a un alumno que llegó a la tutoría"
                      >
                        {addingStudentSessionId === sess.id ? (
                          <>
                            <X className="w-3.5 h-3.5" />
                            <span>Cerrar</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ Agregar Alumno</span>
                          </>
                        )}
                      </button>

                      {/* Botón QR Asistencia */}
                      <button
                        type="button"
                        onClick={() => onOpenQRModal(sess)}
                        className="px-3 py-1.5 rounded-xl bg-[#092c4c] hover:bg-[#153a5c] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="Mostrar código QR en pantalla para que los alumnos escaneen con su celular"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#3a9ad9]" />
                        <span>QR Asistencia</span>
                      </button>

                      {/* Badge de Estado */}
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        allMarked 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {allMarked ? `✓ Completa (${presentCount} Presentes)` : `● ${pendingCount} Pendiente(s)`}
                      </span>
                    </div>
                  </div>

                  {/* Panel Desplegable para Agregar Alumno */}
                  {addingStudentSessionId === sess.id && (
                    <div className="bg-white border-2 border-dashed border-emerald-300 rounded-xl p-4 shadow-sm space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4 text-emerald-600" />
                          Inscribir Alumno a esta Tutoría
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {allStudents.filter(st => !(sess.studentIds || []).includes(st.id)).length} estudiantes disponibles
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
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
                            <option value="">-- Seleccionar Estudiante --</option>
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

                        <div className="sm:col-span-3">
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">Estado de Asistencia</label>
                          <select
                            value={initialStatusToAdd}
                            onChange={(e) => setInitialStatusToAdd(e.target.value as 'presente' | 'pendiente')}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                          >
                            <option value="presente">✓ Presente (Registrado ahora)</option>
                            <option value="pendiente">● Pendiente de marcar</option>
                          </select>
                        </div>

                        <div className="sm:col-span-3 flex items-end">
                          <button
                            type="button"
                            disabled={!selectedStudentToAdd}
                            onClick={() => handleAddStudentToSession(sess.id)}
                            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Inscribir en Lista</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tabla / Lista de Alumnos */}
                  {studentIds.length === 0 ? (
                    <div className="text-xs text-slate-400 italic bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span>No hay alumnos inscritos aún en esta sesión.</span>
                      <button
                        onClick={() => {
                          setAddingStudentSessionId(sess.id);
                          setSelectedStudentToAdd('');
                          setStudentSearchQuery('');
                          setInitialStatusToAdd('presente');
                        }}
                        className="text-emerald-700 font-bold hover:underline not-italic flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Agregar alumno
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700 bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <thead className="bg-slate-100 font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">Estudiante</th>
                            <th className="py-2.5 px-3">RUT</th>
                            <th className="py-2.5 px-3">Carrera</th>
                            <th className="py-2.5 px-3">Estado Actual</th>
                            <th className="py-2.5 px-4 text-center">Marcar Asistencia</th>
                            <th className="py-2.5 px-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {studentIds.map(stId => {
                            const student = allUsers.find(u => u.id === stId);
                            const currentStatus = sess.attendance?.[stId] || 'pendiente';

                            return (
                              <tr key={stId} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-4 font-semibold text-slate-800">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold flex items-center justify-center text-[10px]">
                                      {student?.name?.charAt(0) || 'E'}
                                    </div>
                                    <span>{student?.name || stId}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-500">{student?.rut || '-'}</td>
                                <td className="py-2.5 px-3 text-slate-500">{student?.career || '-'}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                    currentStatus === 'presente' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                    currentStatus === 'ausente' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                    'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}>
                                    {currentStatus === 'presente' ? '✓ PRESENTE' : currentStatus === 'ausente' ? '✗ AUSENTE' : '⏳ PENDIENTE'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleMarkAttendance(sess.id, stId, 'presente')}
                                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        currentStatus === 'presente'
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                      }`}
                                    >
                                      Presente
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMarkAttendance(sess.id, stId, 'ausente')}
                                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                        currentStatus === 'ausente'
                                          ? 'bg-rose-600 text-white shadow-xs'
                                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                      }`}
                                    >
                                      Ausente
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStudentFromSession(sess.id, stId)}
                                    title="Remover de la lista"
                                    className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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
    </div>
  );
};
