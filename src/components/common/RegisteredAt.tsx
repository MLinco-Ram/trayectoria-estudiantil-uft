import React from 'react';

// Fecha y hora de registro de una cuenta, en hora de Chile: "12/11/2026 · 14:32"
export const formatRegisteredAt = (iso?: string): { date: string; time: string } | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const tz = 'America/Santiago';
  return {
    date: d.toLocaleDateString('es-CL', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('es-CL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

export const RegisteredAt: React.FC<{ iso?: string }> = ({ iso }) => {
  const f = formatRegisteredAt(iso);
  if (!f) return <span className="text-slate-400">—</span>;
  return (
    <time dateTime={iso} className="whitespace-nowrap leading-tight block">
      <span className="font-semibold text-slate-700 dark:text-slate-200">{f.date}</span>
      <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-mono">{f.time} hrs</span>
    </time>
  );
};
