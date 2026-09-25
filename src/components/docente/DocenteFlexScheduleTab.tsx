import React, { useState, useMemo } from 'react';
import { StudentRequest, Session, User, UserAvailability } from '../../types';
import { 
  Inbox, 
  CheckCircle2, 
  Clock, 
  Users, 
  Calendar, 
  Plus, 
  AlertCircle, 
  GraduationCap, 
  MapPin, 
  BookOpen, 
  Sparkles, 
  X,
  Check,
  CalendarCheck
} from 'lucide-react';
import { triggerNotification, getTodayDateStr, TIME_SLOTS, SUBJECTS } from '../../data';
import { sessionsApi, studentRequestsApi } from '../../services/api';

interface DocenteFlexScheduleTabProps {
  studentRequests: StudentRequest[];
  setStudentRequests: React.Dispatch<React.SetStateAction<StudentRequest[]>>;
  allUsers: User[];
  allAvailabilities?: UserAvailability[];
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  onReload: () => void;
}

export const DocenteFlexScheduleTab: React.FC<DocenteFlexScheduleTabProps> = ({
  studentRequests,
  setStudentRequests,
  allUsers,
  allAvailabilities = [],
  sessions,
  setSessions,
  onReload,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pendiente' | 'resuelto'>('pendiente');
  const [resolvingReq, setResolvingReq] = useState<StudentRequest | null>(null);

  // Form states for creating customized flex session
  const [flexTitle, setFlexTitle] = useState('');
  const [flexSubject, setFlexSubject] = useState('Matemática');
  const [flexDate, setFlexDate] = useState(getTodayDateStr());
  const [flexTimeSlot, setFlexTimeSlot] = useState(TIME_SLOTS[0]);
  const [flexLocation, setFlexLocation] = useState('Cubículo de Tutorías 3A');
  const [flexTutorId, setFlexTutorId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  const tutores = useMemo(() => allUsers.filter(u => u.role === 'tutor'), [allUsers]);

  // Obtener disponibilidad del tutor seleccionado
  const selectedTutorAvailability = useMemo(() => {
    if (!flexTutorId) return null;
    return allAvailabilities.find(a => a.userId === flexTutorId) || null;
  }, [flexTutorId, allAvailabilities]);

  // Obtener nombre del día para la fecha elegida (ej. "Lunes", "Martes", etc.)
  const selectedDayName = useMemo(() => {
    if (!flexDate) return '';
    const [year, month, day] = flexDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayIndex = d.getDay(); // 0 = Domingo, 1 = Lunes...
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[dayIndex];
  }, [flexDate]);

  // Bloques disponibles del tutor seleccionado para el día de la semana elegido
  const tutorSlotsForSelectedDay = useMemo(() => {
    if (!selectedTutorAvailability || !selectedDayName) return [];
    const dayObj = selectedTutorAvailability.days.find(
      d => d.day.toLowerCase() === selectedDayName.toLowerCase()
    );
    return dayObj ? dayObj.slots : [];
  }, [selectedTutorAvailability, selectedDayName]);

  const handleOpenResolveModal = (req: StudentRequest) => {
    setResolvingReq(req);
    setFlexTitle(`Tutoría Personalizada: ${req.studentName}`);
    setFlexSubject(req.program === 'tutorias' ? 'Matemática' : 'Estrategias de Estudio');
    const defaultTutorId = tutores[0]?.id || '';
    setFlexTutorId(defaultTutorId);
    setFlexDate(getTodayDateStr());
    setFlexTimeSlot(TIME_SLOTS[0]);
    setFlexLocation('Cubículo de Tutorías 3A');
    setFeedback(null);
  };

  const handleConfirmFlexSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingReq) return;

    if (!flexTitle.trim()) {
      setFeedback({ status: 'error', message: 'Por favor ingresa un título para la tutoría.' });
      return;
    }

    if (!flexDate) {
      setFeedback({ status: 'error', message: 'Por favor selecciona la fecha de realización.' });
      return;
    }

    if (!flexTimeSlot) {
      setFeedback({ status: 'error', message: 'Por favor selecciona un bloque de horario estandarizado.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const newSessionId = `session_flex_${Date.now()}`;
    const newSession: Session = {
      id: newSessionId,
      program: resolvingReq.program,
      type: resolvingReq.program === 'tutorias' ? 'tutoria_personalizada' : 'psico_asesoria_individual',
      title: flexTitle.trim(),
      subject: flexSubject,
      date: flexDate,
      timeSlot: flexTimeSlot,
      docenteId: 'docente_1',
      tutorId: flexTutorId || null,
      studentIds: [resolvingReq.studentId],
      maxSpots: 1,
      location: flexLocation.trim(),
      attendance: {
        [resolvingReq.studentId]: 'pendiente'
      }
    };

    try {
      // 1. Guardar nueva sesión en MongoDB Atlas
      await sessionsApi.createSession(newSession);

      // 2. Marcar solicitud como resuelta en MongoDB Atlas
      await studentRequestsApi.updateStudentRequest(resolvingReq.id, {
        status: 'resuelto',
        assignedSessionId: newSessionId,
        resolvedAt: new Date().toISOString()
      });

      // Actualizar estado local inmediatamente
      setSessions(prev => [newSession, ...prev]);
      setStudentRequests(prev => prev.map(r => r.id === resolvingReq.id ? { ...r, status: 'resuelto', assignedSessionId: newSessionId } : r));

      // 3. Notificar por correo al alumno
      const studentUser = allUsers.find(u => u.id === resolvingReq.studentId);
      const tutorUser = allUsers.find(u => u.id === flexTutorId);

      if (studentUser && studentUser.email) {
        triggerNotification(
          studentUser.email,
          studentUser.name,
          `Tu solicitud de horario flexible ha sido adjudicada: "${newSession.title}"`,
          `La coordinación docente ha aprobado tu solicitud de horario flexible para la tutoría "${newSession.title}" del día ${newSession.date}. Ingresa a la plataforma para revisar los detalles.`
        );
      }

      // 4. Notificar por correo al tutor par asignado
      if (tutorUser && tutorUser.email) {
        triggerNotification(
          tutorUser.email,
          tutorUser.name,
          `Nueva Tutoría Individual Asignada: "${newSession.title}"`,
          `Se te ha asignado una nueva tutoría individual para el día ${newSession.date}. Ingresa a la plataforma para revisar los detalles.`
        );
      }

      setFeedback({
        status: 'success',
        message: '¡Sesión flexible adjudicada exitosamente en MongoDB Atlas y notificada a los participantes!'
      });

      setTimeout(() => {
        setResolvingReq(null);
        setFeedback(null);
        setIsSubmitting(false);
        onReload();
      }, 1800);
    } catch (err: any) {
      setIsSubmitting(false);
      setFeedback({
        status: 'error',
        message: err.message || 'Error al adjudicar la sesión flexible en MongoDB.'
      });
    }
  };

  const filteredRequests = useMemo(() => {
    return studentRequests.filter(r => {
      if (filterStatus === 'all') return true;
      return r.status === filterStatus;
    });
  }, [studentRequests, filterStatus]);

  const pendingCount = studentRequests.filter(r => r.status === 'pendiente').length;
  const resolvedCount = studentRequests.filter(r => r.status === 'resuelto').length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Banner Superior */}
        <div className="bg-gradient-to-r from-[#092c4c] via-[#0e375e] to-[#1a4a75] text-white p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#3a9ad9]/20 text-[#3a9ad9] rounded-2xl border border-[#3a9ad9]/30">
                <Inbox className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  Bandeja de Coordinación Flexible & Inconvenientes
                  {pendingCount > 0 && (
                    <span className="bg-amber-500 text-slate-900 text-xs font-black px-2.5 py-0.5 rounded-full uppercase">
                      {pendingCount} Pendientes
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Revisa solicitudes de estudiantes por choque de cátedras y adjudica tutorías personalizadas según la disponibilidad real de los tutores pares.
                </p>
              </div>
            </div>

            {/* Pestañas de Filtro */}
            <div className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-xl border border-white/15">
              <button
                onClick={() => setFilterStatus('pendiente')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterStatus === 'pendiente' 
                    ? 'bg-amber-500 text-slate-900 shadow-sm' 
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                Pendientes ({pendingCount})
              </button>
              <button
                onClick={() => setFilterStatus('resuelto')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterStatus === 'resuelto' 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                Resueltos ({resolvedCount})
              </button>
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterStatus === 'all' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                Todos ({studentRequests.length})
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Solicitudes */}
        <div className="p-6 md:p-8 space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Inbox className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No hay solicitudes en esta categoría.</p>
              <p className="text-xs text-slate-400 mt-1">Las solicitudes enviadas por los alumnos aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isResolved = req.status === 'resuelto';

              return (
                <div 
                  key={req.id} 
                  className={`border rounded-2xl p-6 transition-all ${
                    isResolved 
                      ? 'bg-slate-50/70 border-slate-200' 
                      : 'bg-white border-amber-200 shadow-sm hover:border-amber-400'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#092c4c] text-white flex items-center justify-center font-bold text-sm">
                        {req.studentName ? req.studentName.charAt(0) : 'E'}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">{req.studentName}</h3>
                        <p className="text-xs text-[#3a9ad9] font-semibold">{req.studentCareer || 'Estudiante UFT'}</p>
                      </div>
                    </div>

                    <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto ${
                      isResolved 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isResolved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Adjudicado y Resuelto</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>Pendiente de Adjudicación</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Cuerpo del Mensaje y Solicitud */}
                  <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Programa Requerido</span>
                        <strong className="text-slate-800">
                          {req.program === 'tutorias' ? '🎯 Tutorías Académicas' : '🧠 Apoyo Psicoeducativo'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Disponibilidad Propuesta por el Alumno</span>
                        <span className="text-[#092c4c] font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          ⏰ {req.preferredTime || 'No especificada'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Motivo del Inconveniente</span>
                      <p className="text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-200">
                        "{req.message}"
                      </p>
                    </div>
                  </div>

                  {/* Botón de Acción */}
                  {!isResolved && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => handleOpenResolveModal(req)}
                        className="px-5 py-2.5 bg-[#092c4c] hover:bg-[#0c3c66] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                      >
                        <CalendarCheck className="w-4 h-4 text-[#3a9ad9]" />
                        <span>Adjudicar Sesión Flexible</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL PARA ADJUDICAR HORARIO FLEXIBLE CON DISPONIBILIDAD */}
      {/* ========================================================= */}
      {resolvingReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="bg-[#092c4c] px-6 py-5 flex items-start justify-between text-white shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#3a9ad9] text-[#092c4c] px-2.5 py-0.5 rounded-full">
                  Adjudicación de Horario Flexible
                </span>
                <h3 className="font-extrabold text-lg text-white mt-1">
                  Agendar Tutoría para {resolvingReq.studentName}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Horario sugerido por el alumno: <strong className="text-[#3a9ad9]">{resolvingReq.preferredTime}</strong>
                </p>
              </div>
              <button 
                onClick={() => setResolvingReq(null)} 
                className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleConfirmFlexSession} className="p-6 md:p-8 space-y-5 overflow-y-auto flex-1 text-xs">
              {feedback && (
                <div className={`p-4 rounded-xl text-xs flex items-center gap-2 font-semibold ${
                  feedback.status === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {feedback.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Título de la Sesión */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Título de la Sesión
                </label>
                <input
                  type="text"
                  value={flexTitle}
                  onChange={(e) => setFlexTitle(e.target.value)}
                  placeholder="Ej: Tutoría Individual: Programación Orientada a Objetos"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                  required
                />
              </div>

              {/* Materia y Tutor Asignado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Materia / Área
                  </label>
                  <select
                    value={flexSubject}
                    onChange={(e) => setFlexSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white font-medium"
                  >
                    {SUBJECTS.filter(s => s.program === resolvingReq.program).map(s => (
                      <option key={s.code} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Tutor Par Asignado
                  </label>
                  <select
                    value={flexTutorId}
                    onChange={(e) => setFlexTutorId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white font-medium"
                  >
                    <option value="">-- Sin tutor par (A cargo de Coordinación Docente) --</option>
                    {tutores.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.career || 'Tutor'})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Panel de Disponibilidad Semanal del Tutor Seleccionado */}
              {selectedTutorAvailability && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-[#3a9ad9]" />
                      <span>Disponibilidad declarada por {selectedTutorAvailability.userName || 'el Tutor'}:</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Bloques semanales cargados en MongoDB
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {selectedTutorAvailability.days.map((d) => {
                      const isTargetDay = d.day.toLowerCase() === selectedDayName.toLowerCase();
                      const hasSlots = d.slots && d.slots.length > 0;

                      return (
                        <div
                          key={d.day}
                          className={`p-2 rounded-xl border text-center transition ${
                            isTargetDay 
                              ? 'bg-blue-100 border-[#3a9ad9] text-[#092c4c] font-bold shadow-xs' 
                              : hasSlots 
                              ? 'bg-white border-slate-200 text-slate-700' 
                              : 'bg-slate-100/50 border-slate-200 text-slate-400 opacity-60'
                          }`}
                        >
                          <span className="text-[10px] block font-bold uppercase">{d.day.slice(0, 3)}</span>
                          <span className="text-[11px] font-extrabold">
                            {hasSlots ? `${d.slots.length} bq.` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bloques recomendados para el día seleccionado */}
                  {selectedDayName && (
                    <div className="pt-2 border-t border-slate-200 text-xs">
                      <span className="text-[11px] font-bold text-slate-700 block mb-1">
                        Horarios del Tutor para el día {selectedDayName}:
                      </span>
                      {tutorSlotsForSelectedDay.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {tutorSlotsForSelectedDay.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setFlexTimeSlot(slot)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
                                flexTimeSlot === slot
                                  ? 'bg-[#092c4c] text-white shadow-xs'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <Clock className="w-3 h-3 text-[#3a9ad9]" />
                              <span>{slot}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-700 italic">
                          ⚠️ El tutor no ha marcado disponibilidad específica para el día {selectedDayName}. Puedes seleccionar cualquier bloque estandarizado abajo.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Fecha y Bloque Horario Estandarizado */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Fecha de la Clase ({selectedDayName})
                  </label>
                  <input
                    type="date"
                    value={flexDate}
                    onChange={(e) => setFlexDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Bloque Horario Estandarizado UFT
                  </label>
                  <select
                    value={flexTimeSlot}
                    onChange={(e) => setFlexTimeSlot(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white font-mono font-semibold"
                    required
                  >
                    {TIME_SLOTS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ubicación / Sala */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Ubicación / Sala / Box de Tutoría
                </label>
                <input
                  type="text"
                  value={flexLocation}
                  onChange={(e) => setFlexLocation(e.target.value)}
                  placeholder="Ej: Cubículo de Tutorías 3A / Sala 204"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                  required
                />
              </div>

              {/* Botones del Modal */}
              <div className="pt-4 border-t border-slate-200 flex gap-3">
                <button
                  type="button"
                  onClick={() => setResolvingReq(null)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 bg-[#092c4c] text-white rounded-xl text-xs font-bold hover:bg-[#0c3c66] transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-[#3a9ad9]" />
                  <span>{isSubmitting ? 'Guardando en MongoDB...' : 'Adjudicar y Notificar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
