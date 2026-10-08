import React, { useState, useMemo } from 'react';
import { Session, User } from '../../types';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Trash2, 
  Eye, 
  UserCheck, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  GraduationCap, 
  X,
  AlertCircle
} from 'lucide-react';
import { TIME_SLOTS } from '../../data';
import { sessionsApi } from '../../services/api';

interface DocenteCalendarTabProps {
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  allUsers: User[];
  onReload: () => void;
}

export const DocenteCalendarTab: React.FC<DocenteCalendarTabProps> = ({
  sessions,
  setSessions,
  allUsers,
  onReload,
}) => {
  // Modos de vista: Cuadrícula Semanal interactiva, Calendario Mensual, Agenda por Lista o Vista Diaria
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'day' | 'list'>('week');
  const [programFilter, setProgramFilter] = useState<'all' | 'tutorias' | 'psicoeducativo'>('all');
  const [tutorFilter, setTutorFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<Session | null>(null);

  // Lista de tutores disponibles para el filtro
  const tutores = useMemo(() => allUsers.filter(u => u.role === 'tutor'), [allUsers]);

  // Cálculo de los días de la semana actual basados en el offset
  const weekDays = useMemo(() => {
    const today = new Date();
    // Ajustar al lunes de la semana
    const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes...
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + currentWeekOffset * 7);

    const days = [];
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      days.push({
        name: dayNames[i],
        dateStr,
        dayNumber: d.getDate(),
        monthShort: d.toLocaleDateString('es-CL', { month: 'short' }),
        isToday,
        fullDate: d
      });
    }
    return days;
  }, [currentWeekOffset]);

  // Fechas del rango de semana visible para el header
  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    const first = weekDays[0];
    const last = weekDays[weekDays.length - 1];
    return `${first.dayNumber} de ${first.monthShort} - ${last.dayNumber} de ${last.monthShort} ${first.fullDate.getFullYear()}`;
  }, [weekDays]);

  // Días para el calendario mensual
  const monthDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Ajuste de inicio al lunes
    let startDayOfWeek = firstDay.getDay();
    let padDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days = [];
    // Días vacíos previos
    for (let i = 0; i < padDays; i++) {
      days.push(null);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateObj = new Date(year, month, d);
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${y}-${m}-${dayStr}`;
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      days.push({
        dateStr,
        dayNumber: d,
        isToday
      });
    }

    return days;
  }, [currentMonthDate]);

  // Filtrado de sesiones
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (programFilter !== 'all' && s.program !== programFilter) return false;
      if (tutorFilter !== 'all' && s.tutorId !== tutorFilter) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = s.title?.toLowerCase().includes(term);
        const matchSubject = s.subject?.toLowerCase().includes(term);
        const matchLocation = s.location?.toLowerCase().includes(term);
        const tutor = allUsers.find(u => u.id === s.tutorId);
        const matchTutor = tutor?.name.toLowerCase().includes(term);
        if (!matchTitle && !matchSubject && !matchLocation && !matchTutor) return false;
      }
      return true;
    });
  }, [sessions, programFilter, tutorFilter, searchTerm, allUsers]);

  // Mapa de sesiones por fecha y horario para renderizado instantáneo O(1)
  const sessionMatrix = useMemo(() => {
    const map = new Map<string, Session[]>();
    filteredSessions.forEach(s => {
      const key = `${s.date}_${s.timeSlot}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [filteredSessions]);

  // Mapa de sesiones por fecha
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    filteredSessions.forEach(s => {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    });
    return map;
  }, [filteredSessions]);

  // Eliminar sesión
  const handleDeleteSession = async (sessionId: string, title: string) => {
    if (!window.confirm(`¿Estás seguro de cancelar y eliminar la sesión "${title}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
      await sessionsApi.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (selectedSessionDetail?.id === sessionId) {
        setSelectedSessionDetail(null);
      }
    } catch (err) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } finally {
      onReload();
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra Superior Principal con Métricas Rápidas y Controles */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Banner Institucional Superior */}
        <div className="bg-gradient-to-r from-[#092c4c] via-[#0e375e] to-[#1a4a75] text-white p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#3a9ad9]/20 text-[#3a9ad9] border border-[#3a9ad9]/30">
                  <CalendarIcon className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                    Agenda y Calendario de Tutorías UFT
                    <span className="text-xs bg-[#3a9ad9] text-[#092c4c] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      En Vivo
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Cronograma general de actividades, control de salas, cupos y acompañamiento académico.
                  </p>
                </div>
              </div>
            </div>

            {/* Métricas Resumen Rápidas */}
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-300 block">Total Sesiones</span>
                <span className="text-lg font-black text-white">{filteredSessions.length}</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-300 block">Tutorías Pares</span>
                <span className="text-lg font-black text-[#3a9ad9]">
                  {filteredSessions.filter(s => s.program === 'tutorias').length}
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/15 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-300 block">Psicoeducativo</span>
                <span className="text-lg font-black text-purple-300">
                  {filteredSessions.filter(s => s.program === 'psicoeducativo').length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros, Buscador y Conmutador de Vistas */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Filtros Izquierda */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Buscador */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ramo, sala, tutor..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3a9ad9]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filtro Programa */}
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3a9ad9] cursor-pointer"
            >
              <option value="all">📚 Todos los Programas</option>
              <option value="tutorias">🎯 Tutorías Académicas</option>
              <option value="psicoeducativo">🧠 Apoyo Psicoeducativo</option>
            </select>

            {/* Filtro Tutor */}
            <select
              value={tutorFilter}
              onChange={(e) => setTutorFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3a9ad9] cursor-pointer"
            >
              <option value="all">👤 Todos los Tutores</option>
              {tutores.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Selector de Modos de Vista */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 border border-slate-300/50">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'week' ? 'bg-[#092c4c] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Semana</span>
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'month' ? 'bg-[#092c4c] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Mes</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === 'list' ? 'bg-[#092c4c] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
            </div>
          </div>
        </div>

        {/* ----------------- VISTA 1: CUADRÍCULA SEMANAL PROFESIONAL ----------------- */}
        {viewMode === 'week' && (
          <div className="p-4 md:p-6 space-y-4">
            {/* Navegador de Semanas */}
            <div className="flex items-center justify-between bg-slate-100/80 p-2.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentWeekOffset(prev => prev - 1)}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition"
                  title="Semana Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentWeekOffset(0)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                    currentWeekOffset === 0
                      ? 'bg-[#092c4c] text-white border-[#092c4c]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Esta Semana
                </button>
                <button
                  onClick={() => setCurrentWeekOffset(prev => prev + 1)}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition"
                  title="Semana Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <span>📅 {weekRangeLabel}</span>
              </div>

              <div className="text-xs text-slate-500 font-medium hidden sm:block">
                Lunes a Sábado
              </div>
            </div>

            {/* Matriz Calendario de Horarios Semanal */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full border-collapse text-left min-w-[850px]">
                <thead>
                  <tr className="bg-[#092c4c] text-white">
                    <th className="p-3.5 text-xs font-bold uppercase tracking-wider w-28 border-r border-slate-700 text-center">
                      Bloque Horario
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={day.dateStr}
                        className={`p-3 text-center border-r border-slate-700 last:border-r-0 transition ${
                          day.isToday ? 'bg-[#153a5c]' : ''
                        }`}
                      >
                        <span className="text-xs font-extrabold block text-slate-200">{day.name}</span>
                        <div className="inline-flex items-center justify-center mt-1">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                            day.isToday ? 'bg-[#3a9ad9] text-[#092c4c]' : 'text-slate-300'
                          }`}>
                            {day.dayNumber} {day.monthShort}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {TIME_SLOTS.map((slot, sIdx) => (
                    <tr key={slot} className={sIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      {/* Columna Bloque de Horario */}
                      <td className="p-3 text-center text-xs font-bold text-slate-700 bg-slate-100/70 border-r border-slate-200 align-middle">
                        <div className="flex flex-col items-center gap-0.5">
                          <Clock className="w-3.5 h-3.5 text-[#3a9ad9]" />
                          <span className="font-mono">{slot}</span>
                        </div>
                      </td>

                      {/* Celdas de cada Día */}
                      {weekDays.map((day) => {
                        const cellSessions = sessionMatrix.get(`${day.dateStr}_${slot}`) || [];

                        return (
                          <td
                            key={day.dateStr}
                            className={`p-2 border-r border-slate-200 last:border-r-0 align-top h-28 transition-colors ${
                              day.isToday ? 'bg-blue-50/30' : ''
                            }`}
                          >
                            {cellSessions.length === 0 ? (
                              <div className="h-full min-h-[5rem] flex items-center justify-center border-2 border-dashed border-slate-100 rounded-lg text-slate-300 text-[10px] select-none hover:border-slate-200">
                                —
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {cellSessions.map((sess) => {
                                  const tutor = allUsers.find(u => u.id === sess.tutorId);
                                  const spotsTaken = (sess.studentIds || []).length;
                                  const isFull = spotsTaken >= sess.maxSpots;
                                  const isTutorias = sess.program === 'tutorias';

                                  return (
                                    <div
                                      key={sess.id}
                                      onClick={() => setSelectedSessionDetail(sess)}
                                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md ${
                                        isTutorias
                                          ? 'bg-blue-50/90 border-blue-200 text-blue-950 hover:bg-blue-100'
                                          : 'bg-purple-50/90 border-purple-200 text-purple-950 hover:bg-purple-100'
                                      }`}
                                    >
                                      {/* Header de la tarjeta */}
                                      <div className="flex items-center justify-between gap-1 mb-1">
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                                          isTutorias ? 'bg-blue-200/80 text-blue-900' : 'bg-purple-200/80 text-purple-900'
                                        }`}>
                                          {isTutorias ? 'Tutoría' : 'Psico'}
                                        </span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                          isFull ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                                        }`}>
                                          {spotsTaken}/{sess.maxSpots}
                                        </span>
                                      </div>

                                      {/* Título */}
                                      <p className="font-bold text-xs leading-snug line-clamp-2">
                                        {sess.title}
                                      </p>

                                      {/* Meta info */}
                                      <div className="mt-1.5 text-[10px] opacity-85 space-y-0.5">
                                        <div className="flex items-center gap-1 truncate">
                                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                                          <span className="truncate">{sess.location}</span>
                                        </div>
                                        <div className="flex items-center gap-1 truncate font-medium">
                                          <Users className="w-2.5 h-2.5 shrink-0" />
                                          <span className="truncate">{tutor?.name || 'Docente UFT'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ----------------- VISTA 2: CALENDARIO MENSUAL ----------------- */}
        {viewMode === 'month' && (
          <div className="p-4 md:p-6 space-y-4">
            {/* Navegación de Mes */}
            <div className="flex items-center justify-between bg-slate-100/80 p-2.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const d = new Date(currentMonthDate);
                    d.setMonth(d.getMonth() - 1);
                    setCurrentMonthDate(d);
                  }}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentMonthDate(new Date())}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                >
                  Hoy
                </button>
                <button
                  onClick={() => {
                    const d = new Date(currentMonthDate);
                    d.setMonth(d.getMonth() + 1);
                    setCurrentMonthDate(d);
                  }}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center font-extrabold text-sm text-slate-900 capitalize">
                {currentMonthDate.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Vista Mes Completo
              </div>
            </div>

            {/* Grilla Mensual */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="grid grid-cols-7 bg-[#092c4c] text-white text-xs font-bold text-center py-2.5">
                <div>Lun</div>
                <div>Mar</div>
                <div>Mié</div>
                <div>Jue</div>
                <div>Vie</div>
                <div>Sáb</div>
                <div>Dom</div>
              </div>

              <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
                {monthDays.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty_${idx}`} className="bg-slate-50/50 min-h-[100px] p-2" />;
                  }

                  const daySessions = sessionsByDate.get(day.dateStr) || [];

                  return (
                    <div
                      key={day.dateStr}
                      className={`min-h-[110px] p-2 transition-colors flex flex-col justify-between ${
                        day.isToday ? 'bg-blue-50/40 font-bold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                          day.isToday ? 'bg-[#3a9ad9] text-[#092c4c] font-black' : 'text-slate-700 font-bold'
                        }`}>
                          {day.dayNumber}
                        </span>
                        {daySessions.length > 0 && (
                          <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-1.5 py-0.2 rounded-full">
                            {daySessions.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 overflow-y-auto max-h-20">
                        {daySessions.slice(0, 3).map((sess) => (
                          <div
                            key={sess.id}
                            onClick={() => setSelectedSessionDetail(sess)}
                            className={`text-[10px] p-1 rounded-md font-semibold truncate cursor-pointer transition ${
                              sess.program === 'tutorias'
                                ? 'bg-blue-100 text-blue-900 hover:bg-blue-200'
                                : 'bg-purple-100 text-purple-900 hover:bg-purple-200'
                            }`}
                            title={`${sess.timeSlot} - ${sess.title}`}
                          >
                            ⏰ {sess.timeSlot} • {sess.title}
                          </div>
                        ))}
                        {daySessions.length > 3 && (
                          <div className="text-[9px] text-slate-500 font-bold text-center">
                            +{daySessions.length - 3} más...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ----------------- VISTA 3: AGENDA EN FORMATO LISTA DETALLADA ----------------- */}
        {viewMode === 'list' && (
          <div className="p-4 md:p-6 space-y-4">
            {filteredSessions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">No se encontraron sesiones para los filtros seleccionados.</p>
                <p className="text-xs text-slate-400 mt-1">Prueba cambiando el programa, tutor o término de búsqueda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSessions.map((sess) => {
                  const tutor = allUsers.find(u => u.id === sess.tutorId);
                  const spotsTaken = (sess.studentIds || []).length;
                  const isFull = spotsTaken >= sess.maxSpots;
                  const isTutorias = sess.program === 'tutorias';

                  return (
                    <div
                      key={sess.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs hover:shadow-md hover:border-[#3a9ad9] transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            isTutorias ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {isTutorias ? 'Tutorías' : 'Psicoeducativo'}
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            isFull ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {spotsTaken}/{sess.maxSpots} Cupos Ocupados
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-900 text-sm leading-snug">{sess.title}</h3>

                        <div className="mt-3 space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-3.5 h-3.5 text-[#3a9ad9]" />
                            <span className="font-medium text-slate-800">Fecha: {sess.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-[#3a9ad9]" />
                            <span className="font-mono text-slate-800">{sess.timeSlot}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[#3a9ad9]" />
                            <span>{sess.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-3.5 h-3.5 text-[#3a9ad9]" />
                            <span>Tutor: <strong>{tutor?.name || 'Docente UFT'}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={() => setSelectedSessionDetail(sess)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-[#092c4c] hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Ficha Completa</span>
                        </button>

                        <button
                          onClick={() => handleDeleteSession(sess.id, sess.title)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Eliminar sesión"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----------------- MODAL MODERNO DE DETALLE DE SESIÓN ----------------- */}
      {selectedSessionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Header Modal */}
            <div className="bg-[#092c4c] text-white p-6 flex items-start justify-between">
              <div className="space-y-1">
                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  selectedSessionDetail.program === 'tutorias' ? 'bg-[#3a9ad9] text-[#092c4c]' : 'bg-purple-400 text-purple-950'
                }`}>
                  {selectedSessionDetail.program === 'tutorias' ? 'Programa Tutorías Académicas' : 'Programa Apoyo Psicoeducativo'}
                </span>
                <h3 className="text-base font-extrabold text-white leading-snug pt-1">
                  {selectedSessionDetail.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSessionDetail(null)}
                className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha</span>
                  <strong className="text-slate-900 text-sm">{selectedSessionDetail.date}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Horario</span>
                  <strong className="text-slate-900 text-sm font-mono">{selectedSessionDetail.timeSlot}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Ubicación / Sala</span>
                  <span className="text-slate-800 font-medium">{selectedSessionDetail.location}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Materia / Área</span>
                  <span className="text-slate-800 font-medium">{selectedSessionDetail.subject || 'General'}</span>
                </div>
              </div>

              {/* Responsables */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-900 block">Tutor a Cargo</span>
                  <strong className="text-blue-950 text-xs">
                    {allUsers.find(u => u.id === selectedSessionDetail.tutorId)?.name || 'Docente UFT'}
                  </strong>
                </div>
                <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2.5 py-1 rounded-lg">
                  {selectedSessionDetail.studentIds.length} / {selectedSessionDetail.maxSpots} Inscritos
                </span>
              </div>

              {/* Alumnos inscritos */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#3a9ad9]" />
                  <span>Estudiantes Inscritos ({selectedSessionDetail.studentIds.length})</span>
                </h4>
                {selectedSessionDetail.studentIds.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 border border-dashed border-slate-200">
                    No hay estudiantes inscritos aún en esta sesión.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {selectedSessionDetail.studentIds.map((stId) => {
                      const st = allUsers.find(u => u.id === stId);
                      const att = selectedSessionDetail.attendance?.[stId];

                      return (
                        <div key={stId} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-800">{st?.name || stId}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">{st?.rut}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                            att === 'presente'
                              ? 'bg-emerald-100 text-emerald-800'
                              : att === 'ausente'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {att || 'Pendiente'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => handleDeleteSession(selectedSessionDetail.id, selectedSessionDetail.title)}
                className="px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Cancelar Tutoría</span>
              </button>

              <button
                onClick={() => setSelectedSessionDetail(null)}
                className="px-5 py-2 bg-[#092c4c] text-white rounded-xl font-bold text-xs hover:bg-[#0e375e] transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
