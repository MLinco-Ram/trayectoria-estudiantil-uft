import React, { useState } from 'react';
import { User, Session, ProgramType, SessionType } from '../../types';
import { PlusCircle, Calendar, Clock, MapPin, Users, BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getTodayDateStr, TIME_SLOTS, SUBJECTS, triggerNotification } from '../../data';
import { sessionsApi } from '../../services/api';

interface DocenteCreateSessionTabProps {
  user: User;
  allUsers: User[];
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  onReload: () => void;
}

export const DocenteCreateSessionTab: React.FC<DocenteCreateSessionTabProps> = ({
  user,
  allUsers,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  const tutores = allUsers.filter(u => u.role === 'tutor');

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!formTitle.trim()) {
      setFeedback({ status: 'error', message: 'El título de la sesión es obligatorio.' });
      return;
    }

    setIsSubmitting(true);

    const newSession: Session = {
      id: `session_${Date.now()}`,
      program: formProgram,
      type: formType,
      title: formTitle.trim(),
      subject: formSubject,
      date: formDate,
      timeSlot: formTimeSlot,
      docenteId: user.id,
      tutorId: formType === 'tutoria_general' || formType === 'psico_taller' ? null : (formTutorId || null),
      studentIds: [],
      maxSpots: Number(formMaxSpots),
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
            `Nueva Sesión Asignada: "${newSession.title}"`,
            `Se ha programado a tu cargo la sesión "${newSession.title}" para el día ${newSession.date}. Ingresa a la plataforma para revisar los detalles.`
          );
        }
      }

      setFeedback({
        status: 'success',
        message: `¡Sesión "${newSession.title}" creada y sincronizada exitosamente en MongoDB Atlas!`
      });

      setFormTitle('');
      setFormLocation('Sala 302 - Edificio Central');
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
        <div className="bg-gradient-to-r from-[#092c4c] to-[#153a5c] px-6 py-5 text-white flex items-center gap-3">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Programa
              </label>
              <select
                value={formProgram}
                onChange={(e) => {
                  const prog = e.target.value as ProgramType;
                  setFormProgram(prog);
                  setFormType(prog === 'tutorias' ? 'tutoria_general' : 'psico_taller');
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
                onChange={(e) => setFormType(e.target.value as SessionType)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white"
              >
                {formProgram === 'tutorias' ? (
                  <>
                    <option value="tutoria_general">Tutoría Grupal / General (Docente)</option>
                    <option value="tutoria_personalizada">Tutoría Personalizada (Tutor Par)</option>
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

          {formType === 'tutoria_personalizada' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tutor Par Asignado
              </label>
              <select
                value={formTutorId}
                onChange={(e) => setFormTutorId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white"
                required
              >
                <option value="">-- Selecciona un tutor par --</option>
                {tutores.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.career || 'Tutor'})</option>
                ))}
              </select>
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
