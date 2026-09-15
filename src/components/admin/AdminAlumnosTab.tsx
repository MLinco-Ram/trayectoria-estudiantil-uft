import React from 'react';
import { User } from '../../types';
import { Users, Search, Edit3, Trash2, GraduationCap } from 'lucide-react';

interface AdminAlumnosTabProps {
  alumnos: User[];
  userSearch: string;
  setUserSearch: (v: string) => void;
  handleOpenEditUser: (user: User) => void;
  handleDeleteUser: (user: User) => void;
}

export const AdminAlumnosTab: React.FC<AdminAlumnosTabProps> = ({
  alumnos,
  userSearch,
  setUserSearch,
  handleOpenEditUser,
  handleDeleteUser,
}) => {
  const filteredAlumnos = (alumnos || []).filter(a => 
    a && (
      (a.name || '').toLowerCase().includes((userSearch || '').toLowerCase()) ||
      (a.rut || '').toLowerCase().includes((userSearch || '').toLowerCase()) ||
      (a.email || '').toLowerCase().includes((userSearch || '').toLowerCase()) ||
      (a.career && a.career.toLowerCase().includes((userSearch || '').toLowerCase()))
    )
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Estudiantes Registrados</h3>
          <p className="text-xs text-slate-500">Alumnos inscritos en el portal ({alumnos.length} estudiantes)</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar estudiante..."
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
            {filteredAlumnos.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                  No se encontraron estudiantes con el criterio de búsqueda.
                </td>
              </tr>
            ) : (
              filteredAlumnos.map((alum) => (
                <tr key={alum.id} className="hover:bg-slate-50/80 transition group">
                  <td className="py-3.5 px-5">
                    <div className="font-bold text-slate-900">{alum.name}</div>
                    <div className="text-xs text-[#3a9ad9] font-medium flex items-center gap-1 mt-0.5">
                      <GraduationCap className="w-3 h-3" />
                      {alum.career || 'Carrera no especificada'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">
                    {alum.rut}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                    {alum.email}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
                      <Users className="w-3 h-3" />
                      Alumno
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEditUser(alum)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        title="Editar Estudiante"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(alum)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Eliminar Estudiante"
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
