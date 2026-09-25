import React from 'react';
import { User } from '../../types';
import { UserPlus, Briefcase, Mail, Lock, ShieldCheck, Search, Edit3, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatRut } from '../../data';

interface AdminDocentesTabProps {
  docentes: User[];
  userSearch: string;
  setUserSearch: (v: string) => void;
  newDocName: string;
  setNewDocName: (v: string) => void;
  newDocRut: string;
  setNewDocRut: (v: string) => void;
  newDocEmail: string;
  setNewDocEmail: (v: string) => void;
  newDocCareer: string;
  setNewDocCareer: (v: string) => void;
  newDocPassword: string;
  setNewDocPassword: (v: string) => void;
  docFeedback: { status: 'success' | 'error'; message: string } | null;
  isSubmittingDoc: boolean;
  handleCreateDocente: (e: React.FormEvent) => void;
  handleOpenEditUser: (user: User) => void;
  handleDeleteUser: (user: User) => void;
}

export const AdminDocentesTab: React.FC<AdminDocentesTabProps> = ({
  docentes,
  userSearch,
  setUserSearch,
  newDocName,
  setNewDocName,
  newDocRut,
  setNewDocRut,
  newDocEmail,
  setNewDocEmail,
  newDocCareer,
  setNewDocCareer,
  newDocPassword,
  setNewDocPassword,
  docFeedback,
  isSubmittingDoc,
  handleCreateDocente,
  handleOpenEditUser,
  handleDeleteUser,
}) => {
  const filteredDocentes = (docentes || []).filter(d => 
    d && (
      (d.name || '').toLowerCase().includes((userSearch || '').toLowerCase()) ||
      (d.rut || '').toLowerCase().includes((userSearch || '').toLowerCase()) ||
      (d.email || '').toLowerCase().includes((userSearch || '').toLowerCase()) ||
      (d.career && d.career.toLowerCase().includes((userSearch || '').toLowerCase()))
    )
  );

  return (
    <div className="space-y-6">
      {/* Formulario de Registro de Nuevo Docente */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-[#092c4c] to-[#153a5c] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <UserPlus className="w-5 h-5 text-[#3a9ad9]" />
            </div>
            <div>
              <h2 className="font-bold text-base">Registrar Nuevo Docente / Coordinador</h2>
              <p className="text-xs text-slate-300">Crea credenciales institucionales persistentes en MongoDB Atlas</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateDocente} className="p-6">
          {docFeedback && (
            <div className={`mb-6 p-4 rounded-xl text-sm flex items-center gap-3 ${
              docFeedback.status === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {docFeedback.status === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
              <span>{docFeedback.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nombre Completo
              </label>
              <input
                type="text"
                placeholder="Ej: Viviana Carrasco"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none placeholder:text-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                RUT (9 caracteres)
              </label>
              <input
                type="text"
                placeholder="11.111.111-1"
                value={newDocRut}
                onChange={(e) => setNewDocRut(formatRut(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono placeholder:text-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Correo Institucional
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  placeholder="vcarrasco@uft.cl"
                  value={newDocEmail}
                  onChange={(e) => setNewDocEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Cargo / Rol de Acompañamiento
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <select
                  value={newDocCareer}
                  onChange={(e) => setNewDocCareer(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white text-slate-700"
                >
                  <option value="Jefa de Trayectoria Estudiantil">Jefa de Trayectoria Estudiantil</option>
                  <option value="Coordinación de Tutorías">Coordinación de Tutorías</option>
                  <option value="Profesional Psicoeducativo">Profesional Psicoeducativo</option>
                  <option value="Docente Tutor de Facultad">Docente Tutor de Facultad</option>
                  <option value="Dirección Académica">Dirección Académica</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Contraseña de Acceso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Clave inicial (ej: 123)"
                  value={newDocPassword}
                  onChange={(e) => setNewDocPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono placeholder:text-slate-400"
                  required
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmittingDoc}
                className="w-full py-2.5 px-5 rounded-xl bg-[#3a9ad9] text-white font-bold text-sm hover:bg-[#2b83bd] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {isSubmittingDoc ? 'Registrando...' : 'Crear Docente'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Nómina de Docentes */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Docentes y Coordinadores Registrados</h3>
            <p className="text-xs text-slate-500">Lista activa sincronizada con MongoDB Atlas ({docentes.length} usuarios)</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, RUT o cargo..."
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
                <th className="py-3.5 px-5">Nombre y Cargo</th>
                <th className="py-3.5 px-4">RUT</th>
                <th className="py-3.5 px-4">Rol en Sistema</th>
                <th className="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocentes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                    No se encontraron docentes con el criterio de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredDocentes.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition group">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{doc.name}</div>
                      <div className="text-xs text-[#3a9ad9] font-medium flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3 h-3" />
                        {doc.career || 'Docente UFT'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700">
                      {doc.rut}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                        <ShieldCheck className="w-3 h-3" />
                        Docente / Coordinador
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditUser(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          title="Editar Docente"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(doc)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Eliminar Docente"
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
    </div>
  );
};
