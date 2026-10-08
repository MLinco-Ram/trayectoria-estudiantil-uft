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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="bg-[#092c4c] px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#3a9ad9]/20 rounded-lg text-[#3a9ad9]">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Editar Usuario {editRoles.length > 1 && <span className="text-xs bg-[#3a9ad9] text-[#092c4c] px-2 py-0.5 rounded-full font-black ml-1">Multi-rol</span>}
              </h3>
              <p className="text-xs text-slate-300">ID: {editingUser.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="p-6 space-y-4 overflow-y-auto flex-1">
          {editFeedback && (
            <div className={`p-3.5 rounded-xl text-sm flex items-center gap-2.5 ${
              editFeedback.status === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {editFeedback.status === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{editFeedback.message}</span>
            </div>
          )}

          {/* Configuración Multi-rol */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Roles Asignados (Configuración Multi-rol)
            </label>
            <p className="text-[11px] text-slate-500">
              Puedes marcar múltiples roles para que el usuario elija su panel de acceso al iniciar sesión.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                editRoles.includes('alumno') 
                  ? 'bg-sky-50 border-[#3a9ad9] text-[#092c4c]' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={editRoles.includes('alumno')}
                  onChange={() => toggleRole('alumno')}
                  className="rounded text-[#3a9ad9] focus:ring-[#3a9ad9]"
                />
                <span>🎓 Alumno</span>
              </label>

              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                editRoles.includes('tutor') 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={editRoles.includes('tutor')}
                  onChange={() => toggleRole('tutor')}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>🧑‍🏫 Tutor Par</span>
              </label>

              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                editRoles.includes('docente') 
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-900' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={editRoles.includes('docente')}
                  onChange={() => toggleRole('docente')}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>👨‍🏫 Docente Coord.</span>
              </label>

              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                editRoles.includes('admin') 
                  ? 'bg-amber-50 border-amber-500 text-amber-900' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>
                <input
                  type="checkbox"
                  checked={editRoles.includes('admin')}
                  onChange={() => toggleRole('admin')}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>🛡️ Admin TI</span>
              </label>
            </div>

            {editRoles.includes('tutor') && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Subroles de Tutor (Puedes marcar ambos a la vez)
                  </label>
                  {editTutorTypes.includes('tutor_par') && editTutorTypes.includes('tutor_de_tutores') && (
                    <span className="text-[10px] bg-gradient-to-r from-emerald-500 to-indigo-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                      Doble Perfil Tutor
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${
                      editTutorTypes.includes('tutor_par')
                        ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-400 text-emerald-950'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editTutorTypes.includes('tutor_par')}
                      onChange={() => toggleTutorType('tutor_par')}
                      className="mt-1 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tutor Par (Estándar)</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                        Mis Tutorías, Cargar Horario y Pasar Lista
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${
                      editTutorTypes.includes('tutor_de_tutores')
                        ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-400 text-indigo-950'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editTutorTypes.includes('tutor_de_tutores')}
                      onChange={() => toggleTutorType('tutor_de_tutores')}
                      className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-950">
                        <Shield className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Tutor de Tutores</span>
                      </div>
                      <p className="text-[10px] text-indigo-700/80 leading-tight mt-0.5">
                        Supervisa tutores y activa panel "Tutores a Cargo"
                      </p>
                    </div>
                  </label>
                </div>
                {editTutorTypes.includes('tutor_par') && editTutorTypes.includes('tutor_de_tutores') && (
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    💡 <strong>Conmutación activa:</strong> El usuario podrá alternar en cualquier momento entre el portal de Tutor Par y Tutor de Tutores en el menú "Cambiar de Portal".
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Nombre Completo
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                RUT (9 Caracteres)
              </label>
              <input
                type="text"
                value={editRut}
                onChange={(e) => setEditRut(formatRut(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {editRoles.includes('docente') ? 'Cargo / Rol de Acompañamiento' : 'Carrera'}
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
                {editRoles.includes('docente') ? (
                  <select
                    value={editCareer || 'Coordinación de Tutorías'}
                    onChange={(e) => setEditCareer(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none bg-white text-slate-700 cursor-pointer"
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
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Nueva Contraseña</span>
              <span className="text-[11px] text-slate-400 lowercase font-normal">(Opcional: dejar en blanco para no cambiar)</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Escribe para cambiar la clave actual"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono placeholder:text-slate-400 placeholder:font-sans"
              />
            </div>
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUpdatingUser}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#092c4c] text-white font-semibold text-sm hover:bg-[#0c3c66] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isUpdatingUser ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
