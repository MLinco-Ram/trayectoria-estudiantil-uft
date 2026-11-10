import React, { useMemo, useState } from 'react';
import { DictionaryEntry, Room, Session } from '../../types';
import { dictionaryApi } from '../../services/api';
import { getPrograms, getSubjects, programLabel } from '../../data';
import { DocenteRoomsTab } from './DocenteRoomsTab';
import { BookMarked, DoorOpen, Tags, Layers, Plus, Trash2, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';

interface DocenteDictionaryTabProps {
  rooms: Room[];
  sessions: Session[];
  dictionary: DictionaryEntry[];
  onReload: () => void;
  onReloadDictionary: () => void;
}

type Section = 'rooms' | 'subjects' | 'programs';
const NAME_MAX = 60;

export const DocenteDictionaryTab: React.FC<DocenteDictionaryTabProps> = ({ rooms, sessions, dictionary, onReload, onReloadDictionary }) => {
  const [section, setSection] = useState<Section>('rooms');
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const programs = getPrograms();
  // Texto de la nueva materia/área, por programa (cada tarjeta tiene su propio recuadro)
  const [subjectDrafts, setSubjectDrafts] = useState<Record<string, string>>({});
  const [programName, setProgramName] = useState('');

  // Sesiones activas por programa, para mostrar el uso y bloquear la eliminación
  const activeByProgram = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach(s => { if (s && !s.isCompleted) counts[s.program] = (counts[s.program] || 0) + 1; });
    return counts;
  }, [sessions]);

  const runCreate = async (entry: { kind: 'subject' | 'program'; name: string; program?: string }, okMsg: string, reset: () => void) => {
    setFeedback(null);
    const name = entry.name.trim().replace(/\s+/g, ' ');
    if (!name) {
      setFeedback({ status: 'error', message: 'Escribe un nombre.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await dictionaryApi.createEntry({ ...entry, name });
      setFeedback({ status: 'success', message: okMsg });
      reset();
      onReloadDictionary();
    } catch (err: any) {
      setFeedback({ status: 'error', message: err.message || 'No se pudo guardar.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (entry: DictionaryEntry) => {
    setFeedback(null);
    const extra = entry.kind === 'program' ? ' También se eliminarán sus materias/áreas.' : '';
    if (!confirm(`¿Eliminar "${entry.name}" del diccionario?${extra}`)) return;
    try {
      await dictionaryApi.deleteEntry(entry.id);
      setFeedback({ status: 'success', message: `"${entry.name}" eliminado.` });
      onReloadDictionary();
    } catch (err: any) {
      setFeedback({ status: 'error', message: err.message || 'No se pudo eliminar.' });
    }
  };

  const findEntry = (id: string) => dictionary.find(e => e.id === id);

  const sections: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: 'rooms', label: 'Salas', icon: DoorOpen },
    { id: 'subjects', label: 'Materias / Áreas', icon: Tags },
    { id: 'programs', label: 'Programas', icon: Layers },
  ];

  const feedbackBox = feedback && (
    <div className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
      feedback.status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
    }`}>
      {feedback.status === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
      <span>{feedback.message}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div id="docente-dictionary-header" className="bg-gradient-to-r from-[#092c4c] to-[#153a5c] px-6 py-5 text-white flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-xl text-[#3a9ad9]">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Diccionario</h2>
            <p className="text-xs text-slate-300">Salas, materias/áreas y programas que aparecen al crear sesiones.</p>
          </div>
        </div>
        <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-slate-100">
          {sections.map(sec => {
            const Icon = sec.icon;
            const active = section === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => { setSection(sec.id); setFeedback(null); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  active ? 'bg-[#092c4c] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {section === 'rooms' && <DocenteRoomsTab rooms={rooms} sessions={sessions} onReload={onReload} />}

      {section === 'subjects' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-5">
          {feedbackBox}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {programs.map(p => (
              <div key={p.key} className="border border-slate-200 rounded-2xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-[#092c4c]">{p.label}</h3>
                <ul className="space-y-1.5">
                  {getSubjects(p.key).map(sub => (
                    <li key={sub.code} className="flex items-center justify-between gap-2 text-sm bg-slate-50 rounded-lg px-3 py-1.5">
                      <span className="text-slate-800">{sub.name}</span>
                      {sub.custom ? (
                        <button
                          type="button"
                          onClick={() => { const e = findEntry(sub.code); if (e) handleDelete(e); }}
                          className="p-1 rounded-md text-rose-600 hover:bg-rose-50 cursor-pointer"
                          aria-label={`Eliminar ${sub.name}`}
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span title="Materia/área base del sistema" className="text-slate-400"><Lock className="w-3.5 h-3.5" /></span>
                      )}
                    </li>
                  ))}
                  {getSubjects(p.key).length === 0 && <li className="text-xs text-slate-400">Sin materias/áreas todavía.</li>}
                </ul>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const draft = subjectDrafts[p.key] || '';
                    runCreate(
                      { kind: 'subject', name: draft, program: p.key },
                      `Materia/área "${draft.trim()}" agregada a ${p.label}.`,
                      () => setSubjectDrafts(prev => ({ ...prev, [p.key]: '' }))
                    );
                  }}
                  className="flex gap-2 pt-1"
                >
                  <label className="sr-only" htmlFor={`new-subject-${p.key}`}>Nueva materia o área para {p.label}</label>
                  <input
                    id={`new-subject-${p.key}`}
                    type="text"
                    value={subjectDrafts[p.key] || ''}
                    onChange={(e) => setSubjectDrafts(prev => ({ ...prev, [p.key]: e.target.value }))}
                    placeholder="Nueva materia / área"
                    maxLength={NAME_MAX}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !(subjectDrafts[p.key] || '').trim()}
                    aria-label={`Agregar materia o área a ${p.label}`}
                    className="px-3 py-2 rounded-lg bg-[#092c4c] hover:bg-[#153a5c] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'programs' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-5">
          {feedbackBox}
          <p className="text-xs text-slate-600 leading-relaxed">
            Los programas nuevos funcionan como actividades grupales con un docente responsable: aparecen en "Crear sesión",
            tienen su propia pestaña en el portal del alumno y usan la encuesta de talleres. Agrégales materias/áreas en la sección anterior.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runCreate({ kind: 'program', name: programName }, `Programa "${programName.trim()}" creado.`, () => setProgramName(''));
            }}
            className="flex flex-col sm:flex-row gap-3 sm:items-end"
          >
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Nuevo programa</label>
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="Ej: Talleres de Inducción"
                maxLength={NAME_MAX}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#092c4c] hover:bg-[#153a5c] text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear programa</span>
            </button>
          </form>

          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl">
            {programs.map(p => {
              const entry = p.custom ? dictionary.find(e => e.kind === 'program' && e.key === p.key) : undefined;
              const inUse = activeByProgram[p.key] || 0;
              return (
                <li key={p.key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{p.label}</p>
                    <p className="text-xs text-slate-500">
                      {getSubjects(p.key).length} materia(s)/área(s) • {inUse} sesión(es) activa(s){p.custom ? '' : ' • programa base'}
                    </p>
                  </div>
                  {entry ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(entry)}
                      disabled={inUse > 0}
                      title={inUse > 0 ? 'Tiene sesiones activas; no se puede eliminar' : 'Eliminar programa'}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 border border-rose-200 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  ) : (
                    <span title="Programa base del sistema" className="text-slate-400"><Lock className="w-4 h-4" /></span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
