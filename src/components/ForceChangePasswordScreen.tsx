import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

// Pantalla obligatoria en el primer ingreso de cuentas creadas por un docente o administrador:
// la contraseña inicial (últimos 4 caracteres del RUT) debe reemplazarse antes de usar la plataforma.
export default function ForceChangePasswordScreen() {
  const { currentUser, updateUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.trim().length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const updated = await authApi.changePassword({ currentPassword, newPassword });
      updateUser({ ...updated, mustChangePassword: false });
    } catch (err: any) {
      setError(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-celeste focus:bg-white text-slate-800 transition-all text-xs';
  const inputType = showPasswords ? 'text' : 'password';

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-brand-light relative overflow-hidden py-10">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-celeste/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-navy/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative z-10">
        <div className="bg-brand-navy text-white px-6 py-7 text-center flex flex-col items-center">
          <div className="bg-white p-2.5 rounded-2xl mb-3 shadow-md">
            <img src="/logo-uft.png" alt="Universidad Finis Terrae" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-lg font-bold tracking-tight uppercase">Cambia tu Contraseña</h1>
          <p className="text-xs text-brand-celeste mt-1 font-medium tracking-wide uppercase">Primer ingreso · Trayectoria UFT</p>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Hola{currentUser?.name ? `, ${currentUser.name}` : ''}. Por seguridad debes reemplazar la contraseña inicial que
            recibiste por correo (los últimos 4 caracteres de tu RUT) antes de continuar.
          </p>

          <div>
            <label htmlFor="fcp-current" className="block text-xs font-bold text-slate-700 mb-1">Contraseña actual</label>
            <input id="fcp-current" type={inputType} required autoComplete="current-password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} placeholder="La que recibiste por correo" />
          </div>
          <div>
            <label htmlFor="fcp-new" className="block text-xs font-bold text-slate-700 mb-1">Nueva contraseña</label>
            <input id="fcp-new" type={inputType} required autoComplete="new-password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label htmlFor="fcp-confirm" className="block text-xs font-bold text-slate-700 mb-1">Confirmar nueva contraseña</label>
            <input id="fcp-confirm" type={inputType} required autoComplete="new-password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="Repite la nueva contraseña" />
          </div>

          <button type="button" onClick={() => setShowPasswords((v) => !v)}
            className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-500 hover:text-brand-navy cursor-pointer">
            {showPasswords ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</span>
          </button>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-brand-navy hover:bg-[#07203b] disabled:opacity-60 text-white py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            <span>Guardar y continuar</span>
          </button>
          <button type="button" onClick={logout}
            className="w-full text-[11px] font-bold text-slate-500 hover:text-red-600 flex items-center justify-center space-x-1.5 cursor-pointer">
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </form>
      </div>
    </div>
  );
}
