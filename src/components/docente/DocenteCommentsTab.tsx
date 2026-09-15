import React from 'react';
import { Session, User, SessionFeedback } from '../../types';
import { Star, MessageSquare, Search, Filter, BookOpen } from 'lucide-react';

interface DocenteCommentsTabProps {
  sessions: Session[];
  allUsers: User[];
  commentFilterProgram: 'all' | 'tutorias' | 'psicoeducativo';
  setCommentFilterProgram: (v: 'all' | 'tutorias' | 'psicoeducativo') => void;
  commentFilterRating: 'all' | '5' | '4' | '3' | '2' | '1';
  setCommentFilterRating: (v: 'all' | '5' | '4' | '3' | '2' | '1') => void;
  commentSearch: string;
  setCommentSearch: (v: string) => void;
}

export const DocenteCommentsTab: React.FC<DocenteCommentsTabProps> = ({
  sessions,
  allUsers,
  commentFilterProgram,
  setCommentFilterProgram,
  commentFilterRating,
  setCommentFilterRating,
  commentSearch,
  setCommentSearch,
}) => {
  // Extract all feedbacks across sessions
  const allFeedbacks: Array<{
    sessionTitle: string;
    sessionDate: string;
    program: string;
    tutorName: string;
    studentName: string;
    rating: number;
    comment: string;
    createdAt: string;
  }> = [];

  sessions.forEach(sess => {
    if (sess.ratings) {
      const tutor = allUsers.find(u => u.id === sess.tutorId);
      Object.entries(sess.ratings).forEach(([stId, fbVal]) => {
        const fb = fbVal as SessionFeedback;
        const student = allUsers.find(u => u.id === stId);
        allFeedbacks.push({
          sessionTitle: sess.title,
          sessionDate: sess.date,
          program: sess.program,
          tutorName: tutor ? tutor.name : 'Coordinación Docente',
          studentName: fb.studentName || (student ? student.name : 'Estudiante'),
          rating: fb.rating,
          comment: fb.comment,
          createdAt: fb.createdAt
        });
      });

    }
  });

  const filteredFeedbacks = allFeedbacks.filter(fb => {
    const matchesProg = commentFilterProgram === 'all' || fb.program === commentFilterProgram;
    const matchesRating = commentFilterRating === 'all' || fb.rating.toString() === commentFilterRating;
    const matchesSearch = !commentSearch.trim() || 
      fb.sessionTitle.toLowerCase().includes(commentSearch.toLowerCase()) ||
      fb.studentName.toLowerCase().includes(commentSearch.toLowerCase()) ||
      fb.tutorName.toLowerCase().includes(commentSearch.toLowerCase()) ||
      fb.comment.toLowerCase().includes(commentSearch.toLowerCase());
    return matchesProg && matchesRating && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#3a9ad9]" />
              Retroalimentación y Calificaciones de Alumnos
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Opiniones, nivel de satisfacción y comentarios emitidos tras completar las sesiones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={commentFilterProgram}
              onChange={(e) => setCommentFilterProgram(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:ring-2 focus:ring-[#3a9ad9]"
            >
              <option value="all">Todos los Programas</option>
              <option value="tutorias">Tutorías Académicas</option>
              <option value="psicoeducativo">Apoyo Psicoeducativo</option>
            </select>

            <select
              value={commentFilterRating}
              onChange={(e) => setCommentFilterRating(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:ring-2 focus:ring-[#3a9ad9]"
            >
              <option value="all">Todas las Estrellas</option>
              <option value="5">⭐⭐⭐⭐⭐ (5 Estrellas)</option>
              <option value="4">⭐⭐⭐⭐ (4 Estrellas)</option>
              <option value="3">⭐⭐⭐ (3 Estrellas)</option>
              <option value="2">⭐⭐ (2 Estrellas)</option>
              <option value="1">⭐ (1 Estrella)</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <div className="relative mb-6">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por estudiante, tutor, actividad o comentario..."
              value={commentSearch}
              onChange={(e) => setCommentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
            />
          </div>

          {filteredFeedbacks.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold">No se encontraron comentarios registrados con los filtros actuales.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFeedbacks.map((fb, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{fb.studentName}</span>
                    <div className="flex items-center gap-1 text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < fb.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 italic">"{fb.comment}"</p>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{fb.sessionTitle} • Tutor: <strong className="text-slate-600">{fb.tutorName}</strong></span>
                    <span>{fb.sessionDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
