import React, { useMemo, useState } from 'react';
import { Search, Check, Ban } from 'lucide-react';
import { User } from '../../types';

// Ignora mayúsculas y tildes
const normalize = (v?: string) =>
  (v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface TutorPickerStatus {
  // Texto corto que explica la disponibilidad (ej. "Disponible (8:30 - 9:40)")
  label: string;
  tone: 'ok' | 'warn' | 'none';
  // Si es true el tutor no se puede elegir (no tiene ese horario libre)
  disabled?: boolean;
}

interface TutorPickerProps {
  tutors: User[];
  selectedId: string;
  onSelect: (id: string) => void;
  getStatus: (tutorId: string) => TutorPickerStatus;
  // Si se entrega, se muestra una primera opción para dejar la selección vacía
  emptyLabel?: string;
}

const TONE_CLASS: Record<TutorPickerStatus['tone'], string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-800',
  none: 'bg-slate-100 text-slate-500',
};

// Lista con buscador (nombre, carrera o correo) para elegir un tutor par. Los que no pueden en el horario quedan bloqueados.
export const TutorPicker: React.FC<TutorPickerProps> = ({ tutors, selectedId, onSelect, getStatus, emptyLabel }) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return tutors;
    return tutors.filter(t =>
      normalize(t.name).includes(q) || normalize(t.career).includes(q) || normalize(t.email).includes(q)
    );
  }, [tutors, query]);

  const selected = tutors.find(t => t.id === selectedId);
  const availableCount = results.filter(t => !getStatus(t.id).disabled).length;

  return (
    <div className="space-y-1.5" data-testid="tutor-picker">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar tutor por nombre, carrera o correo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3a9ad9]"
        />
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {selected
          ? <>Seleccionado: <strong className="text-emerald-700 dark:text-emerald-400">{selected.name}</strong></>
          : `${availableCount} de ${results.length} tutor(es) con horario libre`}
      </p>
      <ul className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
        {emptyLabel && (
          <li>
            <button
              type="button"
              onClick={() => onSelect('')}
              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 cursor-pointer transition ${!selectedId ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'}`}
            >
              <span className="font-semibold">{emptyLabel}</span>
              {!selectedId && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          </li>
        )}
        {results.length === 0 ? (
          <li className="px-3 py-2 text-xs text-slate-400">Sin resultados para "{query}".</li>
        ) : results.map(t => {
          const st = getStatus(t.id);
          const isSel = t.id === selectedId;
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={st.disabled}
                aria-disabled={st.disabled}
                onClick={() => onSelect(isSel ? '' : t.id)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition ${
                  st.disabled
                    ? 'opacity-55 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40'
                    : isSel
                    ? 'bg-emerald-50 text-emerald-800 cursor-pointer'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer'
                }`}
              >
                <span className="min-w-0">
                  <span className="font-semibold block truncate">{t.name}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">{t.career || 'Tutor'}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${TONE_CLASS[st.tone]}`}>
                    {st.disabled && <Ban className="w-3 h-3" />}
                    {st.label}
                  </span>
                  {isSel && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
