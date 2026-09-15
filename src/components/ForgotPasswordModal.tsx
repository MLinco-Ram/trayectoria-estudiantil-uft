import React, { useState } from 'react';
import { KeyRound, Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { formatRut } from '../data';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const handleInputChange = (val: string) => {
    // Si contiene '@' o letras de correo (excepto K al final), permitir escribir normal; si son dígitos, formatear como RUT
    if (val.includes('@') || /^[a-zA-Z._-]+$/.test(val)) {
      setIdentifier(val);
    } else {
      setIdentifier(formatRut(val));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setStatus('error');
      setFeedbackMessage('Por favor ingresa tu RUT o correo institucional.');
      return;
    }

    setLoading(true);
    setStatus('idle');
    setFeedbackMessage('');

    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          origin: window.location.origin
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setFeedbackMessage(data.error || 'Hubo un problema al procesar la solicitud.');
      } else {
        setStatus('success');
        setFeedbackMessage(data.message || 'Se ha enviado un enlace a tu correo institucional.');
      }
    } catch (err: any) {
      setStatus('error');
      setFeedbackMessage('No se pudo conectar con el servidor. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative">
        {/* Header */}
        <div className="bg-brand-navy p-6 text-white text-center relative">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
            <KeyRound className="w-6 h-6 text-brand-celeste" />
          </div>
          <h2 className="text-lg font-bold">¿Olvidaste tu contraseña?</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
            Ingresa tu RUT o tu correo institucional para recibir un enlace seguro de restablecimiento.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {status === 'success' ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">¡Correo Despachado!</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed px-2">
                  {feedbackMessage}
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 text-left">
                💡 <strong>Importante:</strong> El enlace expirará en 60 minutos. Si no ves el correo, revisa tu carpeta de <em>Spam</em> o <em>Correo no deseado</em>.
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-brand-navy hover:bg-[#07203b] text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Volver al Inicio de Sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  RUT o Correo Institucional
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ej. 12.345.678-9 o usuario@uft.cl"
                    value={identifier}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-celeste focus:bg-white text-slate-800 transition-all text-xs pl-9"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enviaremos las instrucciones directamente a tu correo registrado.
                </p>
              </div>

              {status === 'error' && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                  <span>{feedbackMessage}</span>
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-brand-navy hover:bg-[#07203b] text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <span>Enviar Enlace</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
