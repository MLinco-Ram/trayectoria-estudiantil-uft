import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { mfaApi } from '../../services/api';

// Verificación en dos pasos (TOTP) para administración y coordinación. Se abre desde el menú de usuario, junto a
// "Cambiar contraseña": activar (escanear el QR con Google/Microsoft Authenticator y probar un código) o
// desactivar (exige un código vigente).
export const canUseMfa = (user?: { role?: string; roles?: string[] } | null): boolean => {
  if (!user) return false;
  const roles = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role];
  return roles.includes('admin') || roles.includes('docente');
};

interface MfaSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MfaSetupModal: React.FC<MfaSetupModalProps> = ({ isOpen: open, onClose }) => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEnabled(null);
    mfaApi.status().then(r => setEnabled(r.enabled)).catch(() => setEnabled(null));
  }, [open]);

  if (!open) return null;

  const close = () => { setSetup(null); setCode(''); setError(null); onClose(); };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e: any) { setError(e?.message || 'No se pudo completar la operación.'); } finally { setBusy(false); }
  };

  // Se dibuja directamente en <body> (portal): dentro de la barra lateral o del menú quedaría atrapado bajo
  // el contenido principal y tras otras ventanas por el contexto de apilamiento de su contenedor.
  return createPortal(
    <>
      {(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/70" role="dialog" aria-modal="true" aria-label="Verificación en dos pasos">
          <div className="w-full max-w-sm max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white">
                {enabled ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-amber-600" />}
                Verificación en dos pasos
              </div>
              <button type="button" onClick={close} aria-label="Cerrar" className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {enabled === null && <p className="text-sm text-slate-600 dark:text-slate-300">Cargando…</p>}

            {enabled === true && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">Está <strong>activa</strong>: al ingresar se pide un código de tu app autenticadora. Para desactivarla, ingresa un código vigente.</p>
                <input value={code} onChange={e => setCode(e.target.value.replace(/[^\d\s]/g, ''))} inputMode="numeric" maxLength={7} placeholder="000000" aria-label="Código de verificación"
                  className="w-full text-center text-lg font-black tracking-[0.3em] font-mono rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-2" />
                <button type="button" disabled={busy || code.replace(/\s/g, '').length !== 6}
                  onClick={() => run(async () => { await mfaApi.disable(code); setEnabled(false); setCode(''); })}
                  className="w-full py-2.5 rounded-xl bg-rose-600 text-white font-bold text-sm disabled:opacity-50 cursor-pointer">Desactivar</button>
              </>
            )}

            {enabled === false && !setup && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">Protege tu cuenta con un código que cambia cada 30 segundos (Google Authenticator, Microsoft Authenticator o Authy). Recomendado para administración y coordinación.</p>
                <button type="button" disabled={busy} onClick={() => run(async () => setSetup(await mfaApi.setup()))}
                  className="w-full py-2.5 rounded-xl bg-[#092c4c] text-white font-bold text-sm disabled:opacity-50 cursor-pointer">Activar</button>
              </>
            )}

            {enabled === false && setup && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">1. Escanea este QR con tu app autenticadora.<br />2. Escribe el código de 6 dígitos que muestra.</p>
                <div className="flex justify-center bg-white p-3 rounded-xl"><QRCodeSVG value={setup.otpauthUri} size={240} level="L" marginSize={4} bgColor="#ffffff" fgColor="#000000" style={{ width: '100%', maxWidth: 240, height: 'auto' }} /></div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 break-all text-center">¿No puedes escanear? Clave manual: <span className="font-mono font-bold">{setup.secret}</span></p>
                <input value={code} onChange={e => setCode(e.target.value.replace(/[^\d\s]/g, ''))} inputMode="numeric" maxLength={7} placeholder="000000" aria-label="Código de verificación"
                  className="w-full text-center text-lg font-black tracking-[0.3em] font-mono rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-2" />
                <button type="button" disabled={busy || code.replace(/\s/g, '').length !== 6}
                  onClick={() => run(async () => { await mfaApi.enable(code); setEnabled(true); setSetup(null); setCode(''); })}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50 cursor-pointer">Confirmar y activar</button>
              </>
            )}

            {error && <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-200 dark:border-red-900">{error}</div>}
          </div>
        </div>
      )}
    </>,
    document.body
  );
};
