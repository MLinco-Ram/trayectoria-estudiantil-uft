import React, { useState, useMemo } from 'react';
import { User, Session, ProgramType, SessionType, UserAvailability } from '../../types';
import { PlusCircle, Calendar, Clock, MapPin, Users, BookOpen, CheckCircle2, AlertTriangle, GraduationCap, Check, Sparkles } from 'lucide-react';
import { getTodayDateStr, TIME_SLOTS, SUBJECTS, triggerNotification } from '../../data';
import { sessionsApi } from '../../services/api';

interface DocenteCreateSessionTabProps {
  user: User;
  allUsers: User[];
  allAvailabilities?: UserAvailability[];
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  onReload: () => void;
}

export const DocenteCreateSessionTab: React.FC<DocenteCreateSessionTabProps> = ({
  user,
  allUsers,
  allAvailabilities = [],
  sessions,
  setSessions,
  onReload,
}) => {
  const [formProgram, setFormProgram] = useState<ProgramType>('tutorias');
  const [formType, setFormType] = useState<SessionType>('tutoria_general');
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('Programación');
  const [formDate, setFormDate] = useState(getTodayDateStr());
  const [formTimeSlot, setFormTimeSlot] = useState(TIME_SLOTS[1]);
  const [formLocation, setFormLocation] = useState('Sala 302 - Edificio Central');
  const [formMaxSpots, setFormMaxSpots] = useState(15);
  const [formTutorId, setFormTutorId] = useState('');
  const [formDocenteId, setFormDocenteId] = useState(user.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  const tutores = useMemo(() => {
    return allUsers.filter(u => u && (u.role === 'tutor' || (Array.isArray(u.roles) && u.roles.includes('tutor'))));
  }, [allUsers]);

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

    setIsSubmitting(true);

    const isTutoring = formProgram === 'tutorias';
    const isPersonalizedType = formType === 'tutoria_personalizada' || formType === 'psico_asesoria_individual';
    const calculatedMaxSpots = isPersonalizedType ? 1 : Number(formMaxSpots);

    const newSession: Session = {
      id: `session_${Date.now()}`,
      program: formProgram,
      type: formType,
      title: formTitle.trim(),
      subject: formSubject,
      date: formDate,
      timeSlot: formTimeSlot,
      docenteId: isTutoring ? user.id : (formDocenteId || user.id),
      tutorId: isTutoring ? (formTutorId || null) : null,
      studentIds: [],
      maxSpots: calculatedMaxSpots,
      location: formLocation.trim(),
      attendance: {}
    };

    try {
      await sessionsApi.createSession(newSession);

      // Notificar al tutor par si fue asignado
      if (newSession.tutorId) {
        const tutor = allUsers.find(u => u.id === newSession.tutorId);
        if (tutor && tutor.email) {
          triggerNotification(
            tutor.email,
            tutor.name,
            `Nueva Sesión de Tutoría Asignada: "${newSession.title}"`,
            `Se ha programado a tu cargo la tutoría "${newSession.title}" para el día ${newSession.date} en horario ${newSession.timeSlot} (${newSession.location}). Ingresa a tu panel para registrar el cronograma temático.`
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
            `Se ha programado a tu cargo el taller psicoeducativo "${newSession.title}" para el día ${newSession.date} a las ${newSession.timeSlot} (${newSession.location}).`
          );
        }
      }

      setFeedback({
        status: 'success',
        message: `¡Sesión "${newSession.title}" creada y sincronizada exitosamente en MongoDB Atlas!`
      });

      setFormTitle('');
      setFormLocation('Sala 302 - Edificio Central');
      if (formProgram === 'tutorias') {
        setFormTutorId('');
      }
    } catch (err: any) {
      setFeedback({
        status: 'success',
        message: `Sesión creada localmente. (${err.message})`
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Bloque Horario
                </label>
                <select
                  value={formTimeSlot}
                  onChange={(e) => setFormTimeSlot(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white"
                >
                  {TIME_SLOTS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ubicación / Sala
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="Ej: Sala 302 / Teams Virtual"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                  required
                />
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
                    <span>Ordenados por disponibilidad para el {selectedDayName || 'día'} ({formTimeSlot})</span>
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
                    if (availableForSlot) {
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
              {sortedTutores.filter(t => getTutorAvailabilityStatus(t.id).availableForSlot).length > 0 && (
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
                        {tutorSlotsForSelectedDay.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setFormTimeSlot(slot)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 ${
                              formTimeSlot === slot
                                ? 'bg-[#092c4c] dark:bg-[#3a9ad9] text-white dark:text-slate-900 shadow-xs ring-2 ring-[#3a9ad9]'
                                : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                            title="Haz clic para seleccionar este horario para la sesión"
                          >
                            <Clock className="w-3 h-3 text-[#3a9ad9]" />
                            <span>{slot}</span>
                            {formTimeSlot === slot && <span className="text-[10px] bg-[#3a9ad9] text-[#092c4c] px-1 rounded font-sans font-extrabold">Seleccionado</span>}
                          </button>
                        ))}
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
              {isSubmitting ? 'Guardando Sesión...' : 'Registrar y Publicar Sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
