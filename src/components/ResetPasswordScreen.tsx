import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle2, AlertCircle, Loader2, ArrowRight, XCircle, KeyRound } from 'lucide-react';

interface ResetPasswordScreenProps {
  token: string;
  onSuccess: () => void;
}

export default function ResetPasswordScreen({ token, onSuccess }: ResetPasswordScreenProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Estados de verificación previa del token
  const [verifying, setVerifying] = useState(true);
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);
  const [invalidMessage, setInvalidMessage] = useState('');

  // Verificar la validez del token al cargar la pantalla
  useEffect(() => {
    const verifyToken = async () => {
      setVerifying(true);
      try {
        const res = await fetch(`/api/verify-reset-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setIsTokenInvalid(true);
          setInvalidMessage(data.error || 'El enlace de recuperación es inválido o ya ha sido utilizado.');
        }
      } catch (e) {
        console.warn('No se pudo verificar token en backend:', e);
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword.trim()) {
      setError('Por favor, ingresa tu nueva contraseña.');
      return;
    }

    if (newPassword.trim().length < 3) {
      setError('La contraseña debe tener al menos 3 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: newPassword.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || 'No se pudo restablecer la contraseña.';
        setError(errMsg);
        if (errMsg.includes('inválido') || errMsg.includes('utilizado') || errMsg.includes('expirado')) {
          setIsTokenInvalid(true);
          setInvalidMessage(errMsg);
        }
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError('Error de conexión con el servidor. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-brand-light relative overflow-hidden py-10">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-celeste/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-navy/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative z-10">
        {/* Header */}
        <div className="bg-brand-navy text-white px-6 py-7 text-center flex flex-col items-center">
          <div className="bg-white p-2.5 rounded-2xl mb-3 shadow-md">
            <img src="/logo-uft.png" alt="Universidad Finis Terrae" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-lg font-bold tracking-tight uppercase">Restablecer Contraseña</h1>
          <p className="text-xs text-brand-celeste mt-1 font-medium tracking-wide uppercase">
            Trayectoria UFT
          </p>
        </div>

        {/* Content */}
        <div className="p-7">
          {verifying ? (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-navy mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Validando enlace de recuperación...</p>
            </div>
          ) : isTokenInvalid ? (
            /* ENLACE INVÁLIDO O YA UTILIZADO */
            <div className="text-center py-4 space-y-4 animate-fade-in">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto border border-red-200">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Enlace No Válido</h2>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 font-medium text-center leading-relaxed">
                {invalidMessage || 'El enlace de recuperación es inválido o ya ha sido utilizado.'}
              </div>
              <p className="text-[11px] text-slate-500">
                Por motivos de seguridad, cada enlace de recuperación solo puede utilizarse una vez y expira en 60 minutos.
              </p>
              <button
                type="button"
                onClick={onSuccess}
                className="w-full bg-brand-navy hover:bg-[#07203b] text-white py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer mt-3"
              >
                <span>Volver al Inicio de Sesión</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : success ? (
            /* ÉXITO AL CAMBIAR CONTRASEÑA */
            <div className="text-center py-4 space-y-4 animate-fade-in">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-base font-bold text-slate-800">¡Contraseña Actualizada!</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tu clave ha sido modificada con éxito. Ya puedes ingresar al sistema con tus nuevas credenciales.
              </p>
              <button
                type="button"
                onClick={onSuccess}
                className="w-full bg-brand-navy hover:bg-[#07203b] text-white py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer mt-4"
              >
                <span>Ir al Inicio de Sesión</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* FORMULARIO DE NUEVA CONTRASEÑA */
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Ingresa y confirma tu nueva contraseña institucional para reactivar el acceso a tu cuenta.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="Ingresa tu nueva clave"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-celeste focus:bg-white text-slate-800 transition-all text-xs"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="Repite tu nueva clave"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-celeste focus:bg-white text-slate-800 transition-all text-xs"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-navy hover:bg-[#07203b] text-white py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <span>Guardar Nueva Contraseña</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
