import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { authApi } from '../../services/api';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Cambiar la contraseña desde el portal, con la sesión iniciada (POST /api/change-password).
// Mismas reglas que el servidor: contraseña actual correcta, mínimo 6, distinta de la actual y que no sea parte del RUT.
export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const close = () => {
    setCurrent(''); setNext(''); setConfirm('');
    setShow({ current: false, next: false, confirm: false });
    setError(null); setDone(false); setSaving(false);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.trim().length < 6) return setError('La nueva contraseña debe tener al menos 6 caracteres.');
    if (next !== confirm) return setError('La nueva contraseña y su confirmación no coinciden.');
    if (next === current) return setError('La nueva contraseña debe ser distinta de la actual.');
    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'No se pudo cambiar la contraseña. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const field = (key: 'current' | 'next' | 'confirm', label: string, value: string, setValue: (v: string) => void, autoComplete: string) => (
    <div>
      <label htmlFor={`cp-${key}`} className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">{label}</label>
      <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-[#3a9ad9]">
        <input
          id={`cp-${key}`}
          type={show[key] ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete={autoComplete}
          required
          className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none"
        />
        <button
          type="button"
          onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
          aria-label={show[key] ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="px-3 text-slate-500 dark:text-slate-400 hover:text-[#3a9ad9] cursor-pointer"
        >
          {show[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 bg-[#092c4c] text-white">
          <h3 id="cp-title" className="flex items-center gap-2 font-extrabold">
            <KeyRound className="w-5 h-5 text-[#3a9ad9]" /> Cambiar contraseña
          </h3>
          <button type="button" onClick={close} aria-label="Cerrar" className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
            <p className="font-bold text-slate-800 dark:text-white">Tu contraseña se cambió correctamente.</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">La próxima vez que ingreses, usa la nueva contraseña (con tu RUT o tu correo).</p>
            <button type="button" onClick={close} className="w-full py-2.5 rounded-xl bg-[#092c4c] hover:bg-[#153a5c] text-white text-sm font-bold cursor-pointer">
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3.5">
            {field('current', 'Contraseña actual', current, setCurrent, 'current-password')}
            {field('next', 'Nueva contraseña', next, setNext, 'new-password')}
            {field('confirm', 'Confirmar nueva contraseña', confirm, setConfirm, 'new-password')}
            <p className="text-xs text-slate-500 dark:text-slate-400">Mínimo 6 caracteres, distinta de la actual y que no sea parte de tu RUT.</p>

            {error && (
              <div role="alert" className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={close} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#092c4c] hover:bg-[#153a5c] text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                {saving ? 'Guardando…' : 'Cambiar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
