import React, { useState } from 'react';
import { CalendarClock, CalendarDays, Clock } from 'lucide-react';
import { Session, User, UserAvailability } from '../../types';
import { TIME_SLOTS } from '../../data';

export const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Nombre del día de la semana (ej. "Lunes") para una fecha YYYY-MM-DD
export const getDayNameFromDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return '';
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[new Date(year, month - 1, day).getDay()];
};

export const findTutorAvailability = (allAvailabilities: UserAvailability[], tutorId: string) => {
  if (!tutorId) return null;
  return allAvailabilities.find(a => a.userId === tutorId && (a.role === 'tutor' || !a.role)) ||
         allAvailabilities.find(a => a.userId === tutorId) || null;
};

const getSlotsForDay = (availability: UserAvailability | null, dayName: string) => {
  if (!availability || !dayName) return [];
  const dayObj = availability.days?.find(d => d.day.toLowerCase() === dayName.toLowerCase());
  return dayObj?.slots || [];
};

export interface TutorSlotStatus {
  hasAnyAvail: boolean;
  availableForDay: boolean;
  availableForSlot: boolean;
  slots: string[];
  conflict?: Session; // Otra sesión del mismo tutor en la misma fecha y bloque
}

// Estado de un tutor para una fecha y bloque: horario declarado + tope con otras sesiones
export const getTutorSlotStatus = (
  allAvailabilities: UserAvailability[],
  sessions: Session[],
  tutorId: string,
  date: string,
  timeSlot: string,
  ignoreSessionId?: string
): TutorSlotStatus => {
  const availability = findTutorAvailability(allAvailabilities, tutorId);
  const slots = getSlotsForDay(availability, getDayNameFromDate(date));
  const conflict = sessions.find(
    s => s.tutorId === tutorId && s.date === date && s.timeSlot === timeSlot && s.id !== ignoreSessionId && !s.isCompleted
  );
  return {
    hasAnyAvail: !!availability?.days?.some(d => d.slots && d.slots.length > 0),
    availableForDay: slots.length > 0,
    availableForSlot: slots.includes(timeSlot),
    slots,
    conflict,
  };
};

interface TutorWeeklyScheduleProps {
  availability: UserAvailability | null;
  highlightDay?: string;
  highlightSlot?: string;
}

// Horario semanal declarado por un tutor, resaltando el día y bloque en evaluación
export const TutorWeeklySchedule: React.FC<TutorWeeklyScheduleProps> = ({ availability, highlightDay = '', highlightSlot = '' }) => {
  const days = (availability?.days || []).filter(d => d.slots && d.slots.length > 0);

  if (days.length === 0) {
    return (
      <p className="text-[11px] text-slate-500 italic">
        Este tutor aún no ha cargado su horario semanal en la plataforma.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {days.map(d => {
        const isTargetDay = d.day.toLowerCase() === highlightDay.toLowerCase();
        return (
          <div key={d.day} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
            <span className={`text-[11px] font-bold w-20 shrink-0 pt-0.5 ${isTargetDay ? 'text-[#092c4c]' : 'text-slate-500'}`}>
              {d.day}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {d.slots.map(slot => (
                <span
                  key={slot}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border ${
                    isTargetDay && slot === highlightSlot
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : isTargetDay
                      ? 'bg-blue-50 border-[#3a9ad9] text-[#092c4c]'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {slot}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface TutorSchedulesCardProps {
  tutores: User[];
  allAvailabilities: UserAvailability[];
}

// Listado general de los horarios declarados por todos los tutores
export const TutorSchedulesCard: React.FC<TutorSchedulesCardProps> = ({ tutores, allAvailabilities }) => {
  const rows = tutores
    .map(t => ({ tutor: t, availability: findTutorAvailability(allAvailabilities, t.id) }))
    .map(r => ({ ...r, total: (r.availability?.days || []).reduce((acc, d) => acc + (d.slots?.length || 0), 0) }))
    .sort((a, b) => (b.total > 0 ? 1 : 0) - (a.total > 0 ? 1 : 0) || a.tutor.name.localeCompare(b.tutor.name));

  const withSchedule = rows.filter(r => r.total > 0).length;
  // Sábado y Domingo solo se muestran si algún tutor declaró bloques esos días
  const visibleDays = WEEK_DAYS.filter(
    (day, idx) => idx < 5 || rows.some(r => getSlotsForDay(r.availability, day).length > 0)
  );

  return (
    <div id="docente-tutors-schedules" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#092c4c] px-6 py-4 flex items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-2.5">
          <CalendarClock className="w-5 h-5 text-[#3a9ad9]" />
          <div>
            <h2 className="font-bold text-base">Horarios Declarados por los Tutores</h2>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Disponibilidad semanal que cada tutor cargó en su portal ("Cargar Horario").
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-bold whitespace-nowrap">
          {withSchedule} de {rows.length} con horario
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="p-6 text-xs text-slate-500">No hay tutores registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-bold">Tutor</th>
                {visibleDays.map(day => (
                  <th key={day} className="px-3 py-2.5 font-bold">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ tutor, availability, total }) => (
                <tr key={tutor.id} className="align-top">
                  <td className="px-4 py-3 min-w-44">
                    <span className="font-bold text-slate-900 block">{tutor.name}</span>
                    <span className="text-[11px] text-slate-500 block">{tutor.career || 'Tutor'}</span>
                    {total > 0 ? (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {total} bloques
                        {availability?.updatedAt ? ` • act. ${new Date(availability.updatedAt).toLocaleDateString('es-CL')}` : ''}
                      </span>
                    ) : (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                        Sin horario cargado
                      </span>
                    )}
                  </td>
                  {visibleDays.map(day => {
                    const slots = getSlotsForDay(availability, day);
                    return (
                      <td key={day} className="px-3 py-3 min-w-28">
                        {slots.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {slots.map(slot => (
                              <span key={slot} className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-semibold whitespace-nowrap w-fit">
                                {slot}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Colores para distinguir a cada tutor dentro del calendario
const TUTOR_COLORS = [
  'bg-sky-100 text-sky-900 border-sky-300',
  'bg-emerald-100 text-emerald-900 border-emerald-300',
  'bg-amber-100 text-amber-900 border-amber-300',
  'bg-violet-100 text-violet-900 border-violet-300',
  'bg-rose-100 text-rose-900 border-rose-300',
  'bg-teal-100 text-teal-900 border-teal-300',
  'bg-orange-100 text-orange-900 border-orange-300',
  'bg-indigo-100 text-indigo-900 border-indigo-300',
];

interface TutorBlocksCalendarProps {
  tutores: User[];
  allAvailabilities: UserAvailability[];
}

// Calendario semanal (días x módulos) con los bloques que cada tutor declaró disponibles
export const TutorBlocksCalendar: React.FC<TutorBlocksCalendarProps> = ({ tutores, allAvailabilities }) => {
  const [selectedTutorId, setSelectedTutorId] = useState<string>('all');

  const tutorsWithSchedule = tutores
    .map(t => ({ tutor: t, availability: findTutorAvailability(allAvailabilities, t.id) }))
    .filter(r => (r.availability?.days || []).some(d => d.slots && d.slots.length > 0))
    .sort((a, b) => a.tutor.name.localeCompare(b.tutor.name))
    .map((r, idx) => ({ ...r, color: TUTOR_COLORS[idx % TUTOR_COLORS.length] }));
  const withoutSchedule = tutores.length - tutorsWithSchedule.length;

  const visible = selectedTutorId === 'all'
    ? tutorsWithSchedule
    : tutorsWithSchedule.filter(r => r.tutor.id === selectedTutorId);

  // Sábado y Domingo solo se muestran si algún tutor declaró bloques esos días
  const visibleDays = WEEK_DAYS.filter(
    (day, idx) => idx < 5 || tutorsWithSchedule.some(r => getSlotsForDay(r.availability, day).length > 0)
  );

  return (
    <div id="docente-calendar-tutor-blocks" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-[#092c4c] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-5 h-5 text-[#3a9ad9] shrink-0" />
          <div>
            <h2 className="font-bold text-base">Calendario de Bloques de los Tutores</h2>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Semana tipo con los módulos en que cada tutor declaró estar disponible.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-bold whitespace-nowrap self-start sm:self-auto">
          {tutorsWithSchedule.length} de {tutores.length} con horario
        </span>
      </div>

      {tutorsWithSchedule.length === 0 ? (
        <p className="p-6 text-xs text-slate-500">
          Ningún tutor ha cargado su horario semanal todavía. Los bloques aparecerán aquí cuando los tutores usen "Cargar Horario" en su portal.
        </p>
      ) : (
        <>
          {/* Filtro y leyenda por tutor */}
          <div className="px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedTutorId('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                selectedTutorId === 'all'
                  ? 'bg-[#092c4c] text-white border-[#092c4c]'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Todos los tutores
            </button>
            {tutorsWithSchedule.map(({ tutor, color }) => (
              <button
                key={tutor.id}
                type="button"
                onClick={() => setSelectedTutorId(selectedTutorId === tutor.id ? 'all' : tutor.id)}
                aria-pressed={selectedTutorId === tutor.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${color} ${
                  selectedTutorId === tutor.id ? 'ring-2 ring-[#092c4c]' : selectedTutorId !== 'all' ? 'opacity-50' : ''
                }`}
              >
                {tutor.name}
              </button>
            ))}
            {withoutSchedule > 0 && (
              <span className="text-[11px] text-slate-500 ml-1">
                {withoutSchedule} {withoutSchedule === 1 ? 'tutor aún sin horario cargado' : 'tutores aún sin horario cargado'}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-bold text-left border-b border-slate-200 w-28">Módulo</th>
                  {visibleDays.map(day => (
                    <th key={day} className="px-2 py-2.5 font-bold text-left border-b border-l border-slate-200">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(slot => (
                  <tr key={slot} className="align-top">
                    <td className="px-3 py-2.5 font-mono font-bold text-slate-700 border-b border-slate-100 whitespace-nowrap bg-slate-50/60">
                      {slot}
                    </td>
                    {visibleDays.map(day => {
                      const available = visible.filter(r => getSlotsForDay(r.availability, day).includes(slot));
                      return (
                        <td key={day} className="px-2 py-2 border-b border-l border-slate-100">
                          {available.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {available.map(({ tutor, color }) => (
                                <span
                                  key={tutor.id}
                                  title={`${tutor.name} • ${day} ${slot}`}
                                  className={`px-2 py-1 rounded-md border text-[11px] font-semibold truncate ${color}`}
                                >
                                  {tutor.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
