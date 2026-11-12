import React, { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { User } from '../../types';
import { usersApi } from '../../services/api';

// Restablece la contraseña del usuario a la inicial (últimos 4 caracteres del RUT),
// se la envía por correo y le exige cambiarla en su próximo ingreso.
export const SendInitialPasswordButton: React.FC<{ user: User }> = ({ user }) => {
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const handleClick = async () => {
    if (!user.email) {
      setFeedback({ ok: false, message: 'El usuario no tiene un correo registrado.' });
      return;
    }
    const confirmed = window.confirm(
      `Se restablecerá la contraseña de ${user.name} a los últimos 4 caracteres de su RUT y se enviará a ${user.email}. ¿Continuar?`
    );
    if (!confirmed) return;

    setSending(true);
    setFeedback(null);
    try {
      const res = await usersApi.sendInitialPassword(user.id);
      setFeedback({ ok: true, message: res.message });
    } catch (err: any) {
      setFeedback({ ok: false, message: err.message || 'No se pudo enviar la contraseña.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={sending}
        className="w-full py-2 px-3 rounded-xl border border-[#3a9ad9] text-[#092c4c] dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
      >
        {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Send className="w-3.5 h-3.5 shrink-0" />}
        <span>{sending ? 'Enviando...' : 'Enviar contraseña por correo'}</span>
      </button>
      {feedback && (
        <p className={`text-[11px] font-semibold ${feedback.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {feedback.message}
        </p>
      )}
    </div>
  );
};
