import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Accessibility, X, RotateCcw, Minus, Plus, Contrast, Link2, Type, Space, PauseCircle } from 'lucide-react';

// Opciones de accesibilidad, iguales en todas las páginas. Se guardan en este navegador (localStorage)
// y se aplican como clases/variables en <html>; los estilos están en index.css (sección "Accesibilidad").
interface A11yPrefs {
  scale: number; // tamaño de texto: 1, 1.15, 1.3, 1.5
  contrast: boolean; // alto contraste
  links: boolean; // resaltar enlaces y botones
  readable: boolean; // fuente más legible
  spacing: boolean; // más espacio entre letras y líneas
  noMotion: boolean; // detener animaciones
}

const SCALES = [1, 1.15, 1.3, 1.5];
const DEFAULTS: A11yPrefs = { scale: 1, contrast: false, links: false, readable: false, spacing: false, noMotion: false };
const STORAGE_KEY = 'uft-a11y';

const loadPrefs = (): A11yPrefs => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const p = { ...DEFAULTS, ...JSON.parse(raw) };
    if (!SCALES.includes(p.scale)) p.scale = 1;
    return p;
  } catch {
    return DEFAULTS;
  }
};

const applyPrefs = (p: A11yPrefs) => {
  const root = document.documentElement;
  root.style.setProperty('--a11y-scale', String(p.scale));
  root.classList.toggle('a11y-scaled', p.scale !== 1);
  root.classList.toggle('a11y-contrast', p.contrast);
  root.classList.toggle('a11y-links', p.links);
  root.classList.toggle('a11y-readable', p.readable);
  root.classList.toggle('a11y-spacing', p.spacing);
  root.classList.toggle('a11y-no-motion', p.noMotion);
};

export const AccessibilityWidget: React.FC = () => {
  const { pathname } = useLocation();
  const [prefs, setPrefs] = useState<A11yPrefs>(loadPrefs);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    applyPrefs(prefs);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* sin almacenamiento: solo esta visita */ }
  }, [prefs]);

  // Cerrar con Esc o al tocar fuera
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  const set = <K extends keyof A11yPrefs>(key: K, value: A11yPrefs[K]) => setPrefs(p => ({ ...p, [key]: value }));
  const scaleIdx = SCALES.indexOf(prefs.scale);
  const isDefault = JSON.stringify(prefs) === JSON.stringify(DEFAULTS);

  // En celular, alumno y tutor tienen barra inferior: la burbuja va sobre ella
  const hasBottomBar = pathname.startsWith('/alumno') || pathname.startsWith('/tutor');
  const bottomCls = hasBottomBar ? 'bottom-24 md:bottom-5' : 'bottom-5';

  const toggles: { key: Exclude<keyof A11yPrefs, 'scale'>; label: string; hint: string; icon: React.ElementType }[] = [
    { key: 'contrast', label: 'Alto contraste', hint: 'Textos y bordes más oscuros', icon: Contrast },
    { key: 'links', label: 'Resaltar enlaces y botones', hint: 'Subrayado y borde al enfocar', icon: Link2 },
    { key: 'readable', label: 'Fuente legible', hint: 'Letra más simple y ancha', icon: Type },
    { key: 'spacing', label: 'Espaciado de texto', hint: 'Más aire entre letras y líneas', icon: Space },
    { key: 'noMotion', label: 'Detener animaciones', hint: 'Sin movimientos ni transiciones', icon: PauseCircle },
  ];

  return (
    <div className={`a11y-widget fixed right-4 ${bottomCls} z-[65] print:hidden`}>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Opciones de accesibilidad"
          className="absolute bottom-16 right-0 w-[min(20rem,calc(100vw-2rem))] max-h-[min(34rem,calc(100vh-9rem))] overflow-y-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-[#092c4c] text-white rounded-t-2xl sticky top-0">
            <span className="flex items-center gap-2 font-extrabold text-sm">
              <Accessibility className="w-5 h-5" /> Accesibilidad
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="p-1.5 rounded-full hover:bg-white/15 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <span className="block text-sm font-bold mb-2">Tamaño de texto</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => set('scale', SCALES[Math.max(0, scaleIdx - 1)])}
                  disabled={scaleIdx <= 0}
                  aria-label="Achicar texto"
                  className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:border-[#3a9ad9]"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 flex gap-1" aria-hidden="true">
                  {SCALES.map((s, i) => (
                    <span key={s} className={`h-2 flex-1 rounded-full ${i <= scaleIdx ? 'bg-[#3a9ad9]' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => set('scale', SCALES[Math.min(SCALES.length - 1, scaleIdx + 1)])}
                  disabled={scaleIdx >= SCALES.length - 1}
                  aria-label="Agrandar texto"
                  className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:border-[#3a9ad9]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1.5" aria-live="polite">{Math.round(prefs.scale * 100)}%</span>
            </div>

            <div className="space-y-2">
              {toggles.map(({ key, label, hint, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="switch"
                  aria-checked={prefs[key]}
                  onClick={() => set(key, !prefs[key])}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    prefs[key]
                      ? 'border-[#3a9ad9] bg-sky-50 dark:bg-sky-950/40'
                      : 'border-slate-200 dark:border-slate-700 hover:border-[#3a9ad9]'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0 text-[#3a9ad9]" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                  </span>
                  <span className={`w-9 h-5 rounded-full relative shrink-0 transition ${prefs[key] ? 'bg-[#3a9ad9]' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${prefs[key] ? 'left-[1.125rem]' : 'left-0.5'}`} />
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPrefs(DEFAULTS)}
              disabled={isDefault}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" /> Restablecer
            </button>
          </div>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label="Opciones de accesibilidad"
        title="Accesibilidad"
        className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg border-[3px] border-white dark:border-slate-900 cursor-pointer active:scale-95 transition-transform ${
          isDefault ? 'bg-[#092c4c] dark:bg-[#1e4a75]' : 'bg-[#3a9ad9]'
        }`}
      >
        <Accessibility className="w-7 h-7" />
      </button>
    </div>
  );
};
