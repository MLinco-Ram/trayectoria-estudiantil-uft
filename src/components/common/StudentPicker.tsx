import React, { useMemo } from 'react';
import { Search, Check } from 'lucide-react';
import { User } from '../../types';

// Ignora mayúsculas, tildes, puntos, guiones y espacios (para buscar "21158790" en "21.158.790-3")
const normalize = (v?: string) =>
  (v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const compact = (v?: string) => normalize(v).replace(/[.\-\s]/g, '');

interface StudentPickerProps {
  students: User[];
  excludeIds?: string[];
  query: string;
  onQueryChange: (q: string) => void;
  selectedId: string;
  onSelect: (id: string) => void;
}

export const StudentPicker: React.FC<StudentPickerProps> = ({ students, excludeIds = [], query, onQueryChange, selectedId, onSelect }) => {
  const results = useMemo(() => {
    const q = normalize(query.trim());
    const qc = compact(query);
    return students
      .filter(st => !excludeIds.includes(st.id))
      .filter(st => {
        if (!q) return true;
        return (
          normalize(st.name).includes(q) ||
          normalize(st.career).includes(q) ||
          normalize(st.email).includes(q) ||
          (!!qc && compact(st.rut).includes(qc))
        );
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [students, excludeIds, query]);

  const selected = students.find(s => s.id === selectedId);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, RUT, carrera o correo..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
        />
      </div>
      <p className="text-[10px] text-slate-500">
        {selected ? <>Seleccionado: <strong className="text-emerald-700">{selected.name}</strong></> : `${results.length} estudiante(s) encontrado(s)`}
      </p>
      <ul className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
        {results.length === 0 ? (
          <li className="px-3 py-2 text-xs text-slate-400">Sin resultados para "{query}".</li>
        ) : results.slice(0, 50).map(st => {
          const isSel = st.id === selectedId;
          return (
            <li key={st.id}>
              <button
                type="button"
                onClick={() => onSelect(isSel ? '' : st.id)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 cursor-pointer transition ${isSel ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-800'}`}
              >
                <span className="min-w-0">
                  <span className="font-semibold block truncate">{st.name}</span>
                  <span className="text-[10px] text-slate-500 block truncate">{st.rut || 'Sin RUT'} • {st.career || 'Estudiante'}</span>
                </span>
                {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            </li>
          );
        })}
        {results.length > 50 && (
          <li className="px-3 py-1.5 text-[10px] text-slate-400">Mostrando 50 de {results.length}; escribe más para acotar.</li>
        )}
      </ul>
    </div>
  );
};
