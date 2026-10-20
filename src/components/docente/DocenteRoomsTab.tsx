import React, { useMemo, useState } from 'react';
import { Room, Session } from '../../types';
import { roomsApi } from '../../services/api';
import { DoorOpen, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface DocenteRoomsTabProps {
  rooms: Room[];
  sessions: Session[];
  onReload: () => void;
}

const ROOM_CODE_MAX = 30;
const ROOM_DESCRIPTION_MAX = 120;

export const DocenteRoomsTab: React.FC<DocenteRoomsTabProps> = ({ rooms, sessions, onReload }) => {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  // Sesiones activas por sala, para mostrar el uso y bloquear la eliminación
  const activeByRoom = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach(s => {
      if (s && !s.isCompleted && s.location) counts[s.location] = (counts[s.location] || 0) + 1;
    });
    return counts;
  }, [sessions]);

  const selectedSessions = useMemo(() => {
    if (!selectedCode) return [];
    return sessions
      .filter(s => s && !s.isCompleted && s.location === selectedCode)
      .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot, undefined, { numeric: true }));
  }, [sessions, selectedCode]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const normalized = code.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      setFeedback({ status: 'error', message: 'Escribe el código de la sala.' });
      return;
    }
    if (rooms.some(r => r.code.toLowerCase() === normalized.toLowerCase())) {
      setFeedback({ status: 'error', message: `La sala ${normalized} ya está registrada.` });
      return;
    }
    setIsSubmitting(true);
    try {
      await roomsApi.createRoom(normalized, description.trim());
      setFeedback({ status: 'success', message: `Sala ${normalized} registrada.` });
      setCode('');
      setDescription('');
      onReload();
    } catch (err: any) {
      setFeedback({ status: 'error', message: err.message || 'No se pudo registrar la sala.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (room: Room) => {
    setFeedback(null);
    try {
      await roomsApi.deleteRoom(room.id);
      setFeedback({ status: 'success', message: `Sala ${room.code} eliminada.` });
      if (selectedCode === room.code) setSelectedCode(null);
      onReload();
    } catch (err: any) {
      setFeedback({ status: 'error', message: err.message || 'No se pudo eliminar la sala.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div id="docente-rooms-header" className="bg-gradient-to-r from-[#092c4c] to-[#153a5c] px-6 py-5 text-white flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-xl text-[#3a9ad9]">
            <DoorOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Salas</h2>
            <p className="text-xs text-slate-300">Registra las salas que se asignan al crear sesiones. Una sala no puede repetirse en el mismo horario.</p>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-5">
          {feedback && (
            <div className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
              feedback.status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {feedback.status === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="sm:w-48">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Código de sala
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej: B405, B-101"
                maxLength={ROOM_CODE_MAX}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Descripción (opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Amberes Sur B - 1, Sala de Trayectorias"
                maxLength={ROOM_DESCRIPTION_MAX}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#092c4c] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#153a5c] disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              Agregar sala
            </button>
          </form>

          {rooms.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay salas registradas. Agrega la primera para poder crear sesiones.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {rooms.map(room => {
                const active = activeByRoom[room.code] || 0;
                return (
                  <div
                    key={room.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCode(selectedCode === room.code ? null : room.code)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCode(selectedCode === room.code ? null : room.code); } }}
                    className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedCode === room.code ? 'border-[#3a9ad9] bg-sky-50 ring-2 ring-[#3a9ad9]/30' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 break-words">{room.code}</p>
                      {room.description && <p className="text-xs text-slate-600 break-words">{room.description}</p>}
                      <p className="text-[11px] text-slate-500">{active > 0 ? `${active} sesión(es) activa(s)` : 'Sin sesiones activas'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(room); }}
                      disabled={active > 0}
                      title={active > 0 ? 'Tiene sesiones activas' : 'Eliminar sala'}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {selectedCode && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-100 text-sm font-semibold text-slate-700">
                Sesiones activas en sala {selectedCode}{rooms.find(r => r.code === selectedCode)?.description ? ` — ${rooms.find(r => r.code === selectedCode)?.description}` : ''}
              </div>
              {selectedSessions.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">Esta sala no tiene sesiones activas.</p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {selectedSessions.map(s => (
                    <li key={s.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {s.program === 'tutorias' ? 'Tutoría' : 'Psicoeducativo'}{s.subject ? ` • ${s.subject}` : ''}
                        </p>
                      </div>
                      <div className="text-xs text-slate-600 sm:text-right">
                        <p className="font-medium">{s.date} • {s.timeSlot}</p>
                        <p>{(s.studentIds || []).length}/{s.maxSpots} inscritos</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
