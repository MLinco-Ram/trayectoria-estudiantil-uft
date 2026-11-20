import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

// Ofrece instalar la plataforma como app (PWA) cuando el navegador lo permite (Chrome/Edge/Android).
// En iPhone no existe este evento: allí se instala con Compartir → "Agregar a pantalla de inicio".
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'uft-install-dismissed';

export const InstallAppPrompt: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(DISMISS_KEY); } catch { /* sin almacenamiento */ }
    if (dismissed) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  const dismiss = () => {
    setDeferred(null);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* sin almacenamiento */ }
  };

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="fixed left-4 bottom-24 md:bottom-5 z-[64] max-w-[calc(100vw-6rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-3 flex items-center gap-3 print:hidden">
      <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl" />
      <div className="min-w-0">
        <span className="block text-sm font-bold text-slate-900 dark:text-white">Instala Trayectoria UFT</span>
        <span className="block text-xs text-slate-600 dark:text-slate-300">Ábrela como app desde tu escritorio o celular.</span>
      </div>
      <button
        type="button"
        onClick={install}
        className="shrink-0 px-3 py-2 rounded-xl bg-[#092c4c] hover:bg-[#153a5c] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
      >
        <Download className="w-4 h-4" /> Instalar
      </button>
      <button type="button" onClick={dismiss} aria-label="No mostrar de nuevo" className="shrink-0 p-1.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
