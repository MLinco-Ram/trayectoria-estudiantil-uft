import React from 'react';
import { User } from '../../types';
import { Edit3, X, Save, Lock, Briefcase, Mail, CheckCircle2, AlertTriangle } from 'lucide-react';
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
  isUpdatingUser,
  editFeedback,
  onClose,
  onSave,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-[#092c4c] px-6 py-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#3a9ad9]/20 rounded-lg text-[#3a9ad9]">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">
                Editar {editingUser.role === 'docente' ? 'Docente / Cargo' : editingUser.role === 'tutor' ? 'Tutor Par' : 'Estudiante'}
              </h3>
              <p className="text-xs text-slate-300">ID: {editingUser.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="p-6 space-y-4">
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
                {editingUser.role === 'docente' ? 'Cargo / Rol' : 'Carrera'}
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={editCareer}
                  onChange={(e) => setEditCareer(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
                />
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
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isUpdatingUser}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#092c4c] text-white font-semibold text-sm hover:bg-[#0c3c66] transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
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
