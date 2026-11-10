import React from 'react';
import { UFT_CAREERS } from '../../data';

const ALL_CAREERS = UFT_CAREERS.flatMap(g => g.careers);

interface CareerSelectProps {
  value: string;
  onChange: (career: string) => void;
  className?: string;
  required?: boolean;
  id?: string;
}

/** Selector de carreras UFT agrupadas por facultad. Si el usuario tiene una carrera antigua fuera de la lista, se muestra para que no se pierda hasta cambiarla. */
export const CareerSelect: React.FC<CareerSelectProps> = ({ value, onChange, className, required, id }) => {
  const isLegacy = !!value && !ALL_CAREERS.includes(value);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className} required={required}>
      <option value="" disabled>Selecciona una carrera</option>
      {isLegacy && <option value={value}>{value} (nombre antiguo)</option>}
      {UFT_CAREERS.map(group => (
        <optgroup key={group.faculty} label={`Facultad de ${group.faculty}`}>
          {group.careers.map(c => <option key={c} value={c}>{c}</option>)}
        </optgroup>
      ))}
    </select>
  );
};
