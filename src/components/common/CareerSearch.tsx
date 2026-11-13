import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { UFT_CAREERS } from '../../data';

// Ignora mayúsculas y tildes al buscar ("ingenieria" encuentra "Ingeniería")
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface CareerSearchProps {
  value: string;
  onChange: (career: string) => void;
  inputClassName?: string;
  placeholder?: string;
}

/**
 * Buscador de carreras UFT para el registro. Reemplaza al <select> nativo, donde la rueda del mouse
 * cambiaba la carrera sin abrir la lista (prueba 1). Se escribe parte del nombre y se elige de la lista
 * filtrada, agrupada por facultad. Teclado: flechas, Enter y Esc.
 */
export const CareerSearch: React.FC<CareerSearchProps> = ({ value, onChange, inputClassName, placeholder = 'Escribe para buscar tu carrera' }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const groups = useMemo(() => {
    const q = normalize(query.trim());
    return UFT_CAREERS
      .map(g => ({ faculty: g.faculty, careers: g.careers.filter(c => !q || normalize(c).includes(q) || normalize(g.faculty).includes(q)) }))
      .filter(g => g.careers.length > 0);
  }, [query]);
  const flat = useMemo(() => groups.flatMap(g => g.careers), [groups]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => setActive(0), [query]);

  // Mantener visible la opción marcada con el teclado
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (career: string) => {
    onChange(career);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive(i => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (flat[active]) choose(flat[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  let index = -1;
  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        // Con la lista cerrada se muestra la carrera elegida; al escribir, lo que se busca
        value={open ? query : value}
        placeholder={value || placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        name="uft-career-search"
        // Chrome ignora autoComplete="off" y rellenaba este campo con el RUT guardado del login:
        // solo se acepta texto si el campo tiene el foco (escritura real del usuario).
        onChange={(e) => {
          if (document.activeElement !== e.target) return;
          setQuery(e.target.value); setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={inputClassName}
      />
      {open ? (
        <Search className="w-4 h-4 text-white/80 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
      ) : (
        <ChevronDown className="w-4 h-4 text-white absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
      )}

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 left-0 right-0 max-h-64 overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1 text-xs"
        >
          {groups.length === 0 && (
            <li className="px-4 py-3 text-slate-500 dark:text-slate-400">No hay carreras que coincidan con "{query}".</li>
          )}
          {groups.map(group => (
            <li key={group.faculty} role="presentation">
              <p className="px-4 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Facultad de {group.faculty}
              </p>
              <ul role="presentation">
                {group.careers.map(c => {
                  index++;
                  const i = index;
                  const isActive = i === active;
                  return (
                    <li
                      key={c}
                      role="option"
                      data-index={i}
                      aria-selected={c === value}
                      onMouseEnter={() => setActive(i)}
                      // mousedown para elegir antes de que el input pierda el foco
                      onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                      className={`px-4 py-2 cursor-pointer ${
                        isActive ? 'bg-[#3a9ad9]/15 text-[#092c4c] dark:text-sky-200' : 'text-slate-700 dark:text-slate-200'
                      } ${c === value ? 'font-bold' : 'font-medium'}`}
                    >
                      {c}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
