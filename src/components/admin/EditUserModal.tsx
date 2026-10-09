import React from 'react';
import { User, Role, TutorType } from '../../types';
import { Edit3, X, Save, Lock, Briefcase, Mail, CheckCircle2, AlertTriangle, Shield, BookOpen, Check } from 'lucide-react';
import { formatRut } from '../../data';

interface EditUserModalProps {
  editingUser: User;
  editName: string;
  setEditName: (v: string) => void;
  editRut: string;
  setEditRut: (v: string) => void;
  editEmail: string;
  setEditEmail: (v: string) => void;
  editCareer: string;
  setEditCareer: (v: string) => void;
  editPassword: string;
  setEditPassword: (v: string) => void;
  editRoles: Role[];
  setEditRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  editTutorTypes: TutorType[];
  setEditTutorTypes: React.Dispatch<React.SetStateAction<TutorType[]>>;
  isUpdatingUser: boolean;
  editFeedback: { status: 'success' | 'error'; message: string } | null;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  editingUser,
  editName,
  setEditName,
  editRut,
  setEditRut,
  editEmail,
  setEditEmail,
  editCareer,
  setEditCareer,
  editPassword,
  setEditPassword,
  editRoles,
  setEditRoles,
  editTutorTypes,
  setEditTutorTypes,
  isUpdatingUser,
  editFeedback,
  onClose,
  onSave,
}) => {
  const toggleRole = (roleToToggle: Role) => {
    setEditRoles(prev => {
      if (prev.includes(roleToToggle)) {
        if (prev.length === 1) return prev; // Mantener al menos 1 rol
        return prev.filter(r => r !== roleToToggle);
      } else {
        if (roleToToggle === 'docente' && (!editCareer || editCareer.trim() === '')) {
          setEditCareer('Docente Practicante');
        }
        return [...prev, roleToToggle];
      }
    });
  };

  const toggleTutorType = (typeToToggle: TutorType) => {
    setEditTutorTypes(prev => {
      if (prev.includes(typeToToggle)) {
        if (prev.length === 1) return prev; // Mantener al menos 1 subrol si tiene rol tutor
        return prev.filter(t => t !== typeToToggle);
      } else {
        return [...prev, typeToToggle];
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[96vh] sm:max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#092c4c] dark:bg-slate-950 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between text-white shrink-0 border-b border-[#153a5c] dark:border-slate-800">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 bg-[#3a9ad9]/20 rounded-lg text-[#3a9ad9] shrink-0">
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base leading-tight truncate flex items-center gap-1.5 flex-wrap">
                <span>Editar Usuario</span>
                {editRoles.length > 1 && (
                  <span className="text-[10px] bg-[#3a9ad9] text-[#092c4c] px-2 py-0.2 rounded-full font-black">
                    Multi-rol
                  </span>
                )}
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-300 dark:text-slate-400 font-mono truncate">
                {editingUser.email || editingUser.rut || editingUser.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Scrollable Body */}
        <form onSubmit={onSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
          {editFeedback && (
            <div className={`p-3 rounded-xl text-xs sm:text-sm flex items-center gap-2.5 ${
              editFeedback.status === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800' 
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
            }`}>
              {editFeedback.status === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{editFeedback.message}</span>
            </div>
          )}

          {/* Configuración Multi-rol */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Roles Asignados (Configuración Multi-rol)
            </label>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Marca los roles pertinentes. El usuario podrá alternar de portal libremente.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 pt-1">
              <label className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold select-none ${
                editRoles.includes('alumno') 
                  ? 'bg-sky-50 dark:bg-sky-950/50 border-[#3a9ad9] text-[#092c4c] dark:text-sky-300' 
                  : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}>
                <input
                  type="checkbox"
                  checked={editRoles.includes('alumno')}
                  onChange={() => toggleRole('alumno')}
                  className="rounded text-[#3a9ad9] focus:ring-[#3a9ad9]"
                />
                <span className="truncate">🎓 Alumno</span>
              </label>

              <label className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold select-none ${
                editRoles.includes('tutor') 
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-200' 
                  : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}>
                <input
                  type="checkbox"
                  checked={editRoles.includes('tutor')}
                  onChange={() => toggleRole('tutor')}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="truncate">🧑‍🏫 Tutor Par</span>
              </label>

              <label className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold select-none ${
                editRoles.includes('docente') 
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-900 dark:text-indigo-200' 
                  : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}>
                <input
                  type="checkbox"
                  checked={editRoles.includes('docente')}
                  onChange={() => toggleRole('docente')}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="truncate">👨‍🏫 Docente Coord.</span>
              </label>

              <label className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold select-none ${
                editRoles.includes('admin') 
                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-200' 
                  : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}>
                <input
                  type="checkbox"
                  checked={editRoles.includes('admin')}
                  onChange={() => toggleRole('admin')}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="truncate">🛡️ Admin TI</span>
              </label>
            </div>

            {/* Subtipos de Tutor */}
            {editRoles.includes('tutor') && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Subroles de Tutor (Marca ambos si aplica)
                  </label>
                  {editTutorTypes.includes('tutor_par') && editTutorTypes.includes('tutor_de_tutores') && (
                    <span className="text-[9px] bg-gradient-to-r from-emerald-500 to-indigo-600 text-white font-extrabold px-1.5 py-0.2 rounded-full shadow-xs">
                      Doble Perfil
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2 p-2 sm:p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${
                      editTutorTypes.includes('tutor_par')
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-400 text-emerald-950 dark:text-emerald-200'
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editTutorTypes.includes('tutor_par')}
                      onChange={() => toggleTutorType('tutor_par')}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 font-bold text-xs">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Tutor Par</span>
                      </div>
                      <p className="text-[9.5px] sm:text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        Mis Tutorías, Cargar Horario y Pasar Lista
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2 p-2 sm:p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${
                      editTutorTypes.includes('tutor_de_tutores')
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-400 text-indigo-950 dark:text-indigo-200'
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editTutorTypes.includes('tutor_de_tutores')}
                      onChange={() => toggleTutorType('tutor_de_tutores')}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 font-bold text-xs text-indigo-950 dark:text-indigo-200">
                        <Shield className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Tutor de Tutores</span>
                      </div>
                      <p className="text-[9.5px] sm:text-[10px] text-indigo-700/80 dark:text-indigo-300/80 leading-tight mt-0.5">
                        Supervisa tutores y activa "Tutores a Cargo"
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Nombre Completo */}
          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Nombre Completo
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-hidden bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              required
            />
          </div>

          {/* RUT y Carrera en Grid adaptable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                RUT (9 Caracteres)
              </label>
              <input
                type="text"
                value={editRut}
                onChange={(e) => setEditRut(formatRut(e.target.value))}
                className="w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-hidden font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 truncate">
                {editRoles.includes('docente') ? 'Cargo / Acompañamiento' : 'Carrera'}
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 absolute left-3 top-2.5 sm:top-3 text-slate-400 pointer-events-none" />
                {editRoles.includes('docente') ? (
                  <select
                    value={editCareer || 'Coordinación de Tutorías'}
                    onChange={(e) => setEditCareer(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-hidden bg-white dark:bg-slate-800 text-slate-800 dark:text-white cursor-pointer"
                  >
                    {!["Jefa de Trayectoria Estudiantil", "Coordinación de Tutorías", "Profesional Psicoeducativo", "Docente Practicante", "Practicante (Apoyo Psicoeducativo / Tutorías)", "Docente Tutor de Facultad", "Dirección Académica"].includes(editCareer) && editCareer ? (
                      <option value={editCareer}>{editCareer}</option>
                    ) : null}
                    <option value="Jefa de Trayectoria Estudiantil">Jefa de Trayectoria Estudiantil</option>
                    <option value="Coordinación de Tutorías">Coordinación de Tutorías</option>
                    <option value="Profesional Psicoeducativo">Profesional Psicoeducativo</option>
                    <option value="Docente Practicante">Docente Practicante</option>
                    <option value="Practicante (Apoyo Psicoeducativo / Tutorías)">Practicante (Apoyo Psicoeducativo / Tutorías)</option>
                    <option value="Docente Tutor de Facultad">Docente Tutor de Facultad</option>
                    <option value="Dirección Académica">Dirección Académica</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={editCareer}
                    onChange={(e) => setEditCareer(e.target.value)}
                    placeholder="Ej: Ing. Civil Informática"
                    className="w-full pl-9 pr-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-hidden bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Correo Electrónico */}
          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 sm:top-3 text-slate-400" />
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-hidden font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Nueva Contraseña */}
          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Nueva Contraseña</span>
              <span className="text-[10px] text-slate-400 lowercase font-normal">(Opcional)</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 sm:top-3 text-slate-400" />
              <input
                type="text"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Escribe para cambiar clave actual"
                className="w-full pl-9 pr-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-hidden font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 placeholder:font-sans"
              />
            </div>
          </div>

          {/* Botones de Acción (Pegados al pie del modal) */}
          <div className="pt-3 pb-1 flex gap-2.5 sticky bottom-0 bg-white dark:bg-slate-900 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUpdatingUser}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#092c4c] dark:bg-[#3a9ad9] text-white dark:text-[#092c4c] font-bold text-xs sm:text-sm hover:bg-[#0c3c66] dark:hover:bg-sky-400 transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>{isUpdatingUser ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
