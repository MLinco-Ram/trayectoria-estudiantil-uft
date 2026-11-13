import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthCalendarProps {
  selected: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
  onSelect: (date: string) => void;
  counts: Record<string, number>; // sesiones disponibles por fecha
  booked: Set<string>; // fechas donde el alumno tiene reserva
}

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Calendario de mes completo para elegir la fecha (reemplaza al selector nativo, pequeño e incómodo).
// Marca los días con sesiones disponibles, los días con reserva propia, hoy y el día elegido.
export const MonthCalendar: React.FC<MonthCalendarProps> = ({ selected, today, onSelect, counts, booked }) => {
  const [view, setView] = useState(() => {
    const [y, m] = selected.split('-').map(Number);
    return { y, m: m - 1 };
  });

  // Si la fecha elegida cambia desde fuera (tira de días), el mes mostrado la sigue
  useEffect(() => {
    const [y, m] = selected.split('-').map(Number);
    setView(v => (v.y === y && v.m === m - 1 ? v : { y, m: m - 1 }));
  }, [selected]);

  const move = (delta: number) => setView(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const rawLabel = first.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1); // "Noviembre de 2026"

  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-2.5 sm:p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => move(-1)} aria-label="Mes anterior" className="p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="block text-sm sm:text-base font-extrabold text-[#092c4c] dark:text-white">{monthLabel}</span>
          {!(view.y === Number(today.slice(0, 4)) && view.m === Number(today.slice(5, 7)) - 1) && (
            <button type="button" onClick={() => onSelect(today)} className="text-[11px] font-bold text-[#3a9ad9] hover:underline cursor-pointer">
              Volver a hoy
            </button>
          )}
        </div>
        <button type="button" onClick={() => move(1)} aria-label="Mes siguiente" className="p-2 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map(w => (
          <span key={w} className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase py-1">{w}</span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const key = toKey(view.y, view.m, day);
          const isSelected = key === selected;
          const isToday = key === today;
          const isPast = key < today;
          const count = counts[key] || 0;
          const hasBooking = booked.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={`${day}${count ? `, ${count} ${count === 1 ? 'sesión' : 'sesiones'}` : ''}${hasBooking ? ', tienes reserva' : ''}`}
              aria-pressed={isSelected}
              className={`relative h-11 sm:h-12 rounded-lg flex flex-col items-center justify-center text-sm font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#092c4c] dark:bg-[#3a9ad9] text-white dark:text-slate-900 shadow-sm'
                  : count > 0
                  ? 'bg-white dark:bg-slate-900 border border-[#3a9ad9]/50 text-[#092c4c] dark:text-sky-200 hover:bg-sky-50 dark:hover:bg-slate-800'
                  : isPast
                  ? 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              } ${isToday && !isSelected ? 'ring-2 ring-[#3a9ad9]' : ''}`}
            >
              <span className="leading-none">{day}</span>
              {count > 0 && (
                <span className={`mt-0.5 text-[10px] leading-none font-extrabold ${isSelected ? 'text-sky-200 dark:text-[#092c4c]' : 'text-[#3a9ad9]'}`}>
                  {count}
                </span>
              )}
              {hasBooking && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        <span className="flex items-center gap-1.5"><span className="font-extrabold text-[#3a9ad9]">2</span> sesiones disponibles</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> tienes reserva</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded ring-2 ring-[#3a9ad9]" /> hoy</span>
      </div>
    </div>
  );
};
