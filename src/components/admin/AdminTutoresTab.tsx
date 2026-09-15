import React from 'react';
import { User } from '../../types';
import { BookOpen, Search, Edit3, Trash2, GraduationCap } from 'lucide-react';

interface AdminTutoresTabProps {
  tutores: User[];
  userSearch: string;
  setUserSearch: (v: string) => void;
  handleOpenEditUser: (user: User) => void;
  handleDeleteUser: (user: User) => void;
}

export const AdminTutoresTab: React.FC<AdminTutoresTabProps> = ({
  tutores,
  userSearch,
  setUserSearch,
  handleOpenEditUser,
  handleDeleteUser,
}) => {
  const filteredTutores = (tutores || []).filter(t => 
    t && (
      (t.name || '').toLowerCase().includes((userSearch || '').toLowerCase()) ||
      (t.rut || '').toLowerCase().includes((userSearch || '').toLowerCase()) ||
      (t.email || '').toLowerCase().includes((userSearch || '').toLowerCase()) ||
      (t.career && t.career.toLowerCase().includes((userSearch || '').toLowerCase()))
    )
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Tutores Pares Registrados</h3>
          <p className="text-xs text-slate-500">Equipo de estudiantes tutores ({tutores.length} tutores)</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar tutor..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-5">Nombre y Carrera</th>
              <th className="py-3.5 px-4">RUT</th>
              <th className="py-3.5 px-4">Correo Institucional</th>
              <th className="py-3.5 px-4">Rol</th>
              <th className="py-3.5 px-5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTutores.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                  No se encontraron tutores con el criterio de búsqueda.
                </td>
              </tr>
            ) : (
              filteredTutores.map((tut) => (
                <tr key={tut.id} className="hover:bg-slate-50/80 transition group">
                  <td className="py-3.5 px-5">
                    <div className="font-bold text-slate-900">{tut.name}</div>
                    <div className="text-xs text-[#3a9ad9] font-medium flex items-center gap-1 mt-0.5">
                      <GraduationCap className="w-3 h-3" />
                      {tut.career || 'Carrera no especificada'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">
                    {tut.rut}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                    {tut.email}
                  </td>
                  <td className="py-3.5 px-4">
                    {tut.tutorType === 'tutor_de_tutores' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                        <BookOpen className="w-3 h-3 text-indigo-600" />
                        Tutor de Tutores
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <BookOpen className="w-3 h-3 text-emerald-600" />
                        Tutor Par
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEditUser(tut)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        title="Editar Tutor"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(tut)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Eliminar Tutor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
