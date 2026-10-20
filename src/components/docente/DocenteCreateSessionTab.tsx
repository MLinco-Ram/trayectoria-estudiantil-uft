import React, { useState, useMemo } from 'react';
import { User, Session, ProgramType, SessionType, UserAvailability, Room } from '../../types';
import { PlusCircle, X, Calendar, Clock, MapPin, Users, BookOpen, CheckCircle2, AlertTriangle, GraduationCap, Check, Sparkles } from 'lucide-react';
import { getTodayDateStr, TIME_SLOTS, SUBJECTS, triggerNotification, findRoomConflict } from '../../data';
import { sessionsApi } from '../../services/api';

interface DocenteCreateSessionTabProps {
  user: User;
  allUsers: User[];
  allAvailabilities?: UserAvailability[];
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  rooms: Room[];
  onReload: () => void;
}

export const DocenteCreateSessionTab: React.FC<DocenteCreateSessionTabProps> = ({
  user,
  allUsers,
  allAvailabilities = [],
  sessions,
  setSessions,
  rooms,
  onReload,
}) => {
  const [formProgram, setFormProgram] = useState<ProgramType>('tutorias');
  const [formType, setFormType] = useState<SessionType>('tutoria_general');
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('Programación');
  const [formDate, setFormDate] = useState(getTodayDateStr());
  const [formTimeSlot, setFormTimeSlot] = useState(TIME_SLOTS[1]);
  const [formLocation, setFormLocation] = useState('');
  const [formMaxSpots, setFormMaxSpots] = useState(15);
  const [formTutorId, setFormTutorId] = useState('');
  const [formStudentId, setFormStudentId] = useState('');
  const [useExactTime, setUseExactTime] = useState(false);
  const [exactStart, setExactStart] = useState('11:30');
  const [exactEnd, setExactEnd] = useState('12:30');
  // Horarios ofrecidos para una sesión 1 a 1 de cupo libre: cada uno se publica como una sesión y el estudiante elige cuál tomar
  const [offeredSlots, setOfferedSlots] = useState<{ date: string; timeSlot: string }[]>([]);
  const [formDocenteId, setFormDocenteId] = useState(user.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  const tutores = useMemo(() => {
    return allUsers.filter(u => u && (u.role === 'tutor' || (Array.isArray(u.roles) && u.roles.includes('tutor'))));
  }, [allUsers]);

  const alumnos = useMemo(() => {
    return allUsers
      .filter(u => u && (u.role === 'alumno' || (Array.isArray(u.roles) && u.roles.includes('alumno'))))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allUsers]);

  const isPersonalizedForm = formType === 'tutoria_personalizada' || formType === 'psico_asesoria_individual';
  const canOfferSlots = isPersonalizedForm && !formStudentId;
  // En tutorías de cupo libre el horario se elige solo en la grilla de bloques con tutores disponibles
  const pickSlotsFromGrid = canOfferSlots && formProgram === 'tutorias';

  // "8:30" en vez de "08:30", igual que TIME_SLOTS
  const trimHour = (t: string) => t.replace(/^0(\d)/, '$1');
  const currentTimeSlot = isPersonalizedForm && useExactTime
    ? `${trimHour(exactStart)} - ${trimHour(exactEnd)}`
    : formTimeSlot;
  // Horarios que ocupará la sesión: los ofrecidos (cupo libre) o el elegido arriba
  const roomSlotsToCheck = canOfferSlots && offeredSlots.length > 0
    ? offeredSlots
    : [{ date: formDate, timeSlot: currentTimeSlot }];
  const isExactTimeInvalid = isPersonalizedForm && useExactTime && (!exactStart || !exactEnd || exactStart >= exactEnd);

  const toggleOfferedSlot = (date: string, timeSlot: string) => {
    setOfferedSlots(prev => prev.some(o => o.date === date && o.timeSlot === timeSlot)
      ? prev.filter(o => !(o.date === date && o.timeSlot === timeSlot))
      : [...prev, { date, timeSlot }].sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot)));
  };

  const handleAddOfferedSlot = () => {
    setFeedback(null);
    if (isExactTimeInvalid) {
      setFeedback({ status: 'error', message: 'Indica una hora de inicio anterior a la hora de término.' });
      return;
    }
    if (offeredSlots.some(o => o.date === formDate && o.timeSlot === currentTimeSlot)) return;
    setOfferedSlots(prev => [...prev, { date: formDate, timeSlot: currentTimeSlot }]
      .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot)));
  };

  const docentes = useMemo(() => {
    return allUsers.filter(u => u && (u.role === 'docente' || (Array.isArray(u.roles) && u.roles.includes('docente'))));
  }, [allUsers]);

  // Obtener nombre del día para la fecha elegida (ej. "Lunes", "Martes", etc.)
  const selectedDayName = useMemo(() => {
    if (!formDate) return '';
    const [year, month, day] = formDate.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const dayIndex = d.getDay(); // 0 = Domingo, 1 = Lunes...
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[dayIndex];
  }, [formDate]);

  // Helper para verificar estado de disponibilidad de un tutor en el día y bloque actual
  const getTutorAvailabilityStatus = (tutorId: string) => {
    const avail = allAvailabilities.find(a => a.userId === tutorId && (a.role === 'tutor' || !a.role)) ||
                  allAvailabilities.find(a => a.userId === tutorId);
    if (!avail || !selectedDayName) return { hasAnyAvail: false, availableForDay: false, availableForSlot: false, slots: [] };
    const dayObj = avail.days?.find(
      d => d.day.toLowerCase() === selectedDayName.toLowerCase()
    );
    const slots = dayObj ? dayObj.slots : [];
    const availableForDay = slots.length > 0;
    const availableForSlot = slots.includes(formTimeSlot);
    return { hasAnyAvail: true, availableForDay, availableForSlot, slots };
  };

  // Tutores ordenados con prioridad a quienes están disponibles en el bloque actual
  const sortedTutores = useMemo(() => {
    return [...tutores].sort((a, b) => {
      const statA = getTutorAvailabilityStatus(a.id);
      const statB = getTutorAvailabilityStatus(b.id);
      if (statA.availableForSlot && !statB.availableForSlot) return -1;
      if (!statA.availableForSlot && statB.availableForSlot) return 1;
      if (statA.availableForDay && !statB.availableForDay) return -1;
      if (!statA.availableForDay && statB.availableForDay) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [tutores, formDate, formTimeSlot, allAvailabilities, selectedDayName]);

  // Tutores con el bloque declarado en su horario para la fecha elegida y sin otra sesión a esa hora
  // (los que declararon el bloque pero ya tienen sesión quedan aparte, para explicar por qué no se puede elegir)
  const tutorsBySlot = useMemo(() => {
    const result: Record<string, { free: User[]; busy: User[] }> = {};
    TIME_SLOTS.forEach(slot => {
      const declared = tutores.filter(t => getTutorAvailabilityStatus(t.id).slots.includes(slot));
      const isBusy = (t: User) => sessions.some(s => s.tutorId === t.id && s.date === formDate && s.timeSlot === slot && !s.isCompleted);
      result[slot] = { free: declared.filter(t => !isBusy(t)), busy: declared.filter(isBusy) };
    });
    return result;
  }, [tutores, allAvailabilities, selectedDayName, sessions, formDate]);

  // Obtener disponibilidad del tutor seleccionado
  const selectedTutorAvailability = useMemo(() => {
    if (!formTutorId) return null;
    return allAvailabilities.find(a => a.userId === formTutorId && (a.role === 'tutor' || !a.role)) ||
           allAvailabilities.find(a => a.userId === formTutorId) || null;
  }, [formTutorId, allAvailabilities]);

  // Bloques del tutor seleccionado para el día de la semana elegido
  const tutorSlotsForSelectedDay = useMemo(() => {
    if (!selectedTutorAvailability || !selectedDayName) return [];
    const dayObj = selectedTutorAvailability.days?.find(
      d => d.day.toLowerCase() === selectedDayName.toLowerCase()
    );
    return dayObj ? dayObj.slots : [];
  }, [selectedTutorAvailability, selectedDayName]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!formTitle.trim()) {
      setFeedback({ status: 'error', message: 'El título de la sesión es obligatorio.' });
      return;
    }

    if (formProgram === 'tutorias' && !formTutorId) {
      setFeedback({ status: 'error', message: 'Por favor selecciona un tutor para la tutoría académica.' });
      return;
    }

    // Hora exacta (solo 1 a 1): debe ser un rango válido
    if (pickSlotsFromGrid && offeredSlots.length === 0) {
      setFeedback({ status: 'error', message: 'Selecciona al menos un bloque con tutores disponibles en "Horarios ofrecidos".' });
      return;
    }

    const useOfferedSlots = canOfferSlots && offeredSlots.length > 0;
    if (!useOfferedSlots && isExactTimeInvalid) {
      setFeedback({ status: 'error', message: 'Indica una hora de inicio anterior a la hora de término.' });
      return;
    }

    if (!formLocation) {
      setFeedback({ status: 'error', message: 'Selecciona una sala. Si no aparece, regístrala en "Salas".' });
      return;
    }

    // La sala no puede repetirse en un mismo horario
    for (const sl of roomSlotsToCheck) {
      const conflict = findRoomConflict(sessions, formLocation, sl.date, sl.timeSlot);
      if (conflict) {
        setFeedback({ status: 'error', message: `La sala ${formLocation} ya está ocupada el ${sl.date} (${conflict.timeSlot}) por "${conflict.title}".` });
        return;
      }
    }

    setIsSubmitting(true);

    const isTutoring = formProgram === 'tutorias';
    const isPersonalizedType = isPersonalizedForm;
    const calculatedMaxSpots = isPersonalizedType ? 1 : Number(formMaxSpots);
    // Sin estudiante elegido, la sesión 1 a 1 queda como cupo libre que cualquier estudiante puede tomar
    const reservedStudentId = isPersonalizedType ? formStudentId : '';
    const slots = useOfferedSlots ? offeredSlots : [{ date: formDate, timeSlot: currentTimeSlot }];
    const scheduleText = slots.map(sl => `${sl.date} (${sl.timeSlot})`).join(', ');

    const offerGroupId = slots.length > 1 ? `offer_${Date.now()}` : undefined;

    const newSessions: Session[] = slots.map((sl, i) => ({
      id: `session_${Date.now()}_${i}`,
      ...(offerGroupId ? { offerGroupId } : {}),
      program: formProgram,
      type: formType,
      title: formTitle.trim(),
      subject: formSubject,
      date: sl.date,
      timeSlot: sl.timeSlot,
      docenteId: isTutoring ? user.id : (formDocenteId || user.id),
      tutorId: isTutoring ? (formTutorId || null) : null,
      studentIds: reservedStudentId ? [reservedStudentId] : [],
      ...(reservedStudentId ? { reservedForStudentId: reservedStudentId } : {}),
      maxSpots: calculatedMaxSpots,
      location: formLocation.trim(),
      attendance: reservedStudentId ? { [reservedStudentId]: 'pendiente' } : {}
    }));
    const newSession = newSessions[0];

    try {
      for (const session of newSessions) {
        await sessionsApi.createSession(session);
      }

      // Notificar al tutor par si fue asignado
      if (newSession.tutorId) {
        const tutor = allUsers.find(u => u.id === newSession.tutorId);
        if (tutor && tutor.email) {
          triggerNotification(
            tutor.email,
            tutor.name,
            `Nueva Sesión de Tutoría Asignada: "${newSession.title}"`,
            `Se ha programado a tu cargo la tutoría "${newSession.title}" ${slots.length > 1 ? 'en los horarios' : 'el día'} ${scheduleText} (${newSession.location}). Ingresa a tu panel para registrar el cronograma temático.`
          );
        }
      }

      // Notificar al estudiante para quien se creó la sesión personalizada
      if (reservedStudentId) {
        const student = allUsers.find(u => u.id === reservedStudentId);
        if (student && student.email) {
          triggerNotification(
            student.email,
            student.name,
            `Sesión Personalizada Asignada: "${newSession.title}"`,
            `La coordinación docente agendó para ti la sesión personalizada "${newSession.title}" el día ${newSession.date} en horario ${newSession.timeSlot} (${newSession.location}). Ingresa a la plataforma para revisar los detalles.`
          );
        }
      }

      // Notificar al docente si es un taller psicoeducativo asignado a otro docente
      if (!isTutoring && newSession.docenteId && newSession.docenteId !== user.id) {
        const docObj = allUsers.find(u => u.id === newSession.docenteId);
        if (docObj && docObj.email) {
          triggerNotification(
            docObj.email,
            docObj.name,
            `Nuevo Taller Psicoeducativo Asignado: "${newSession.title}"`,
            `Se ha programado a tu cargo la sesión psicoeducativa "${newSession.title}" ${slots.length > 1 ? 'en los horarios' : 'el día'} ${scheduleText} (${newSession.location}).`
          );
        }
      }

      setFeedback({
        status: 'success',
        message: newSessions.length > 1
          ? `¡${newSessions.length} horarios de "${newSession.title}" publicados! Cada estudiante podrá elegir uno.`
          : `¡Sesión "${newSession.title}" creada y sincronizada exitosamente en MongoDB Atlas!`
      });

      setFormTitle('');
      setFormStudentId('');
      setOfferedSlots([]);
      setFormLocation('');
      if (formProgram === 'tutorias') {
        setFormTutorId('');
      }
    } catch (err: any) {
      setFeedback({
        status: 'error',
        message: err.message || 'No se pudo crear la sesión en MongoDB Atlas.'
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => onReload(), 800);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div id="docente-create-header" className="bg-gradient-to-r from-[#092c4c] to-[#153a5c] px-6 py-5 text-white flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-xl text-[#3a9ad9]">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Registrar Nueva Sesión o Taller</h2>
            <p className="text-xs text-slate-300">Publica cupos disponibles en el explorador de alumnos</p>
          </div>
        </div>

        <form onSubmit={handleCreateSession} className="p-6 md:p-8 space-y-5">
          {feedback && (
            <div className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
              feedback.status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {feedback.status === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div id="docente-create-program-selector" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Programa
              </label>
              <select
                value={formProgram}
                onChange={(e) => {
                  const prog = e.target.value as ProgramType;
                  setFormProgram(prog);
                  if (prog === 'tutorias') {
                    setFormType('tutoria_general');
                    setFormMaxSpots(15);
                  } else {
                    setFormType('psico_taller');
                    setFormMaxSpots(20);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white"
              >
                <option value="tutorias">Programa de Tutorías Académicas</option>
                <option value="psicoeducativo">Programa de Apoyo Psicoeducativo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Modalidad / Tipo de Sesión
              </label>
              <select
                value={formType}
                onChange={(e) => {
                  const val = e.target.value as SessionType;
                  setFormType(val);
                  if (val === 'tutoria_personalizada' || val === 'psico_asesoria_individual') {
                    setFormMaxSpots(1);
                  } else if (val === 'tutoria_general') {
                    setFormMaxSpots(15);
                  } else if (val === 'psico_taller') {
                    setFormMaxSpots(20);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white"
              >
                {formProgram === 'tutorias' ? (
                  <>
                    <option value="tutoria_general">Tutoría Grupal / Colectiva</option>
                    <option value="tutoria_personalizada">Tutoría Personalizada (1 a 1)</option>
                  </>
                ) : (
                  <>
                    <option value="psico_taller">Taller Grupal de Hábitos y Ansiedad</option>
                    <option value="psico_asesoria_individual">Asesoría Individual Psicoeducativa</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {isPersonalizedForm && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Estudiante para quien es la sesión
              </label>
              <select
                value={formStudentId}
                onChange={(e) => setFormStudentId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white"
              >
                <option value="">Cupo libre (lo toma el primer estudiante que se inscriba)</option>
                {alumnos.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.career || 'Estudiante'})</option>
                ))}
              </select>
              <p className="text-[11px] text-amber-800 mt-1.5">
                {formStudentId
                  ? 'Solo este estudiante verá la sesión; no aparece para inscripción de otros alumnos.'
                  : 'Todos los estudiantes verán el cupo hasta que uno se inscriba; desde ese momento queda reservado para esa persona.'}
              </p>
            </div>
          )}

          <div id="docente-create-form-fields" className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Título Descriptivo de la Sesión
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ej: Taller de Cálculo Diferencial: Optimización y Derivadas"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Materia / Área
                </label>
                <select
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white"
                >
                  {SUBJECTS.filter(s => s.program === formProgram).map(s => (
                    <option key={s.code} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Fecha
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                  required
                />
              </div>

              {!pickSlotsFromGrid && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {isPersonalizedForm && useExactTime ? 'Hora Exacta' : 'Bloque Horario'}
                  </label>
                  {isPersonalizedForm && (
                    <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useExactTime}
                        onChange={(e) => setUseExactTime(e.target.checked)}
                      />
                      Hora exacta
                    </label>
                  )}
                </div>
                {isPersonalizedForm && useExactTime ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={exactStart}
                      onChange={(e) => setExactStart(e.target.value)}
                      className="w-full px-2 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                      required
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="time"
                      value={exactEnd}
                      onChange={(e) => setExactEnd(e.target.value)}
                      className="w-full px-2 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                      required
                    />
                  </div>
                ) : (
                  <select
                    value={formTimeSlot}
                    onChange={(e) => setFormTimeSlot(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white"
                  >
                    {TIME_SLOTS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}
              </div>
              )}
            </div>

            {/* SELECCIÓN DE TUTOR PARA EL PROGRAMA DE TUTORÍAS (GRUPALES Y PERSONALIZADAS) */}
            {formProgram === 'tutorias' && (
              <div id="docente-create-tutor-select" className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Tutor Asignado ({formType === 'tutoria_general' ? 'Tutoría Grupal' : 'Tutoría Personalizada'})
                    </label>
                    <span className="text-[11px] text-slate-600 dark:text-[#3a9ad9] font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#3a9ad9]" />
                      <span>Ordenados por disponibilidad para el {selectedDayName || 'día'}{pickSlotsFromGrid ? '' : ` (${formTimeSlot})`}</span>
                    </span>
                  </div>

                  <select
                    value={formTutorId}
                    onChange={(e) => setFormTutorId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    required
                  >
                    <option value="">-- Selecciona un tutor par --</option>
                    {sortedTutores.map(t => {
                      const { availableForSlot, availableForDay, slots } = getTutorAvailabilityStatus(t.id);
                      let labelStatus = '';
                      if (pickSlotsFromGrid) {
                        labelStatus = availableForDay ? ` • ⏰ ${slots.length} bq. en ${selectedDayName}` : ` • ⚪ Sin horario en ${selectedDayName}`;
                      } else if (availableForSlot) {
                        labelStatus = ` • ✅ DISPONIBLE (${formTimeSlot})`;
                      } else if (availableForDay) {
                        labelStatus = ` • ⏰ ${slots.length} bq. en ${selectedDayName}`;
                      } else {
                        labelStatus = ` • ⚪ Sin horario en ${selectedDayName}`;
                      }
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.career || 'Tutor'}){labelStatus}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Botones de Selección Rápida de Tutores Disponibles en este Horario */}
                {!pickSlotsFromGrid && sortedTutores.filter(t => getTutorAvailabilityStatus(t.id).availableForSlot).length > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 rounded-xl p-3.5">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Tutores con disponibilidad exacta en este horario ({selectedDayName} a las {formTimeSlot}):</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {sortedTutores.filter(t => getTutorAvailabilityStatus(t.id).availableForSlot).map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFormTutorId(t.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            formTutorId === t.id
                              ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-300 dark:ring-emerald-700'
                              : 'bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>{t.name}</span>
                          {formTutorId === t.id && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Panel de Horarios del Tutor Seleccionado */}
                {selectedTutorAvailability && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-[#3a9ad9]" />
                        <span>Horarios declarados por {selectedTutorAvailability.userName || 'el Tutor'}:</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        Bloques semanales cargados en el sistema
                      </span>
                    </div>

                    {/* Resumen semanal */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                      {selectedTutorAvailability.days?.map((d) => {
                        const isTargetDay = d.day.toLowerCase() === selectedDayName.toLowerCase();
                        const hasSlots = d.slots && d.slots.length > 0;

                        return (
                          <div
                            key={d.day}
                            className={`p-2 rounded-xl border text-center transition text-xs ${
                              isTargetDay 
                                ? 'bg-blue-100 dark:bg-[#3a9ad9]/20 border-[#3a9ad9] text-[#092c4c] dark:text-[#3a9ad9] font-bold shadow-xs' 
                                : hasSlots 
                                ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200' 
                                : 'bg-slate-100/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-60'
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

                    {/* Bloques del día seleccionado con acción al hacer clic */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                        Bloques de {selectedTutorAvailability.userName || 'este tutor'} para el día {selectedDayName}:
                      </span>
                      {tutorSlotsForSelectedDay.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {tutorSlotsForSelectedDay.map((slot) => {
                            // En cupo libre, el clic agrega o quita el bloque de los horarios ofrecidos
                            const isChosen = pickSlotsFromGrid
                              ? offeredSlots.some(o => o.date === formDate && o.timeSlot === slot)
                              : formTimeSlot === slot;
                            return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => pickSlotsFromGrid ? toggleOfferedSlot(formDate, slot) : setFormTimeSlot(slot)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                isChosen
                                  ? 'bg-[#092c4c] dark:bg-[#3a9ad9] text-white dark:text-slate-900 shadow-xs ring-2 ring-[#3a9ad9]'
                                  : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                              title="Haz clic para seleccionar este horario para la sesión"
                            >
                              <Clock className="w-3 h-3 text-[#3a9ad9]" />
                              <span>{slot}</span>
                              {isChosen && <span className="text-[10px] bg-[#3a9ad9] text-[#092c4c] px-1 rounded font-sans font-extrabold">Seleccionado</span>}
                            </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-800 dark:text-amber-300 italic bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/70">
                          ⚠️ Este tutor no tiene bloques declarados para el día {selectedDayName}. Puedes seleccionar otro tutor disponible o mantener el bloque estándar.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {canOfferSlots && (
              <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Horarios ofrecidos ({offeredSlots.length})
                  </p>
                  {!pickSlotsFromGrid && (
                  <button
                    type="button"
                    onClick={handleAddOfferedSlot}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#3a9ad9] text-white text-xs font-semibold hover:bg-[#2b88c5] transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Agregar {formDate} ({currentTimeSlot})
                  </button>
                  )}
                </div>
                {formProgram === 'tutorias' && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-600">
                      Bloques del {selectedDayName} {formDate} {formTutorId ? 'según el horario del tutor elegido' : 'con tutores disponibles'} (solo se pueden elegir los que tienen tutor):
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {TIME_SLOTS.map(slot => {
                        const { free, busy } = tutorsBySlot[slot] || { free: [], busy: [] };
                        const isAvailable = formTutorId ? free.some(t => t.id === formTutorId) : free.length > 0;
                        const isTutorBusy = !!formTutorId && busy.some(t => t.id === formTutorId);
                        const isSelected = offeredSlots.some(o => o.date === formDate && o.timeSlot === slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            disabled={!isAvailable && !isSelected}
                            onClick={() => toggleOfferedSlot(formDate, slot)}
                            title={[
                              free.length > 0 ? `Disponibles: ${free.map(t => t.name).join(', ')}` : '',
                              busy.length > 0 ? `Con otra sesión a esta hora: ${busy.map(t => t.name).join(', ')}` : '',
                            ].filter(Boolean).join('\n') || 'Ningún tutor declaró este bloque'}
                            className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold text-left transition ${
                              isSelected
                                ? 'bg-[#092c4c] border-[#092c4c] text-white'
                                : isAvailable
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                                  : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <span className="block">{slot}</span>
                            <span className="block text-[10px] font-normal">
                              {formTutorId
                                ? (isAvailable ? 'Tutor disponible' : isTutorBusy ? 'Tutor con otra sesión' : 'Tutor sin este bloque')
                                : free.length > 0
                                  ? `${free.length} tutor${free.length === 1 ? '' : 'es'} libre${free.length === 1 ? '' : 's'}`
                                  : busy.length > 0
                                    ? `${busy.length} ocupado${busy.length === 1 ? '' : 's'}`
                                    : 'Sin tutores'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {offeredSlots.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {offeredSlots.map(o => (
                      <span key={`${o.date}_${o.timeSlot}`} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-sky-200 text-xs text-slate-700">
                        {o.date} · {o.timeSlot}
                        <button
                          type="button"
                          onClick={() => setOfferedSlots(prev => prev.filter(p => p !== o))}
                          className="text-slate-400 hover:text-rose-600"
                          aria-label="Quitar horario"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-600">
                    {pickSlotsFromGrid
                      ? 'Marca uno o más bloques (puedes cambiar la fecha y seguir marcando). Cada horario se publica como un cupo 1 a 1 y el estudiante toma el que prefiera.'
                      : 'Elige fecha y horario y presiona "Agregar" para ofrecer varias opciones. Cada horario se publica como un cupo 1 a 1 y el estudiante toma el que prefiera. Si no agregas ninguno, se publica solo el horario seleccionado arriba.'}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sala
                </label>
                <select
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white"
                  required
                >
                  <option value="">{rooms.length === 0 ? 'No hay salas registradas (ver "Salas")' : 'Selecciona una sala'}</option>
                  {rooms.map(r => {
                    const busy = roomSlotsToCheck.some(sl => findRoomConflict(sessions, r.code, sl.date, sl.timeSlot));
                    return (
                      <option key={r.id} value={r.code} disabled={busy}>
                        {r.code}{r.description ? ` (${r.description})` : ''}{busy ? ' — ocupada en este horario' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cupo Máximo
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={formMaxSpots}
                  onChange={(e) => setFormMaxSpots(parseInt(e.target.value, 10))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>


          {/* SELECCIÓN DE DOCENTE RESPONSABLE PARA PROGRAMA PSICOEDUCATIVO */}
          {formProgram === 'psicoeducativo' && (
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Docente / Profesional Psicoeducativo Responsable
                </label>
                <select
                  value={formDocenteId}
                  onChange={(e) => setFormDocenteId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  required
                >
                  {docentes.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.id === user.id ? '(Tú)' : ''} — {d.career || 'Docente / Coordinador'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Los talleres y asesorías psicoeducativas son guiados directamente por docentes y profesionales del área de acompañamiento.
                </p>
              </div>
            </div>
          )}

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 rounded-xl bg-[#092c4c] text-white font-bold text-sm hover:bg-[#0c3c66] transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              {isSubmitting
                ? 'Guardando Sesión...'
                : canOfferSlots && offeredSlots.length > 1
                  ? `Publicar ${offeredSlots.length} Horarios`
                  : 'Registrar y Publicar Sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
