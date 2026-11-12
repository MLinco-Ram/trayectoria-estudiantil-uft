import React, { useEffect, useRef, useState } from 'react';

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

// Duración y curva compartidas por el foco, la tarjeta y el scroll, para que lleguen juntos
export const SPOTLIGHT_DURATION_MS = 420;
export const SPOTLIGHT_EASING = 'cubic-bezier(0.25, 1, 0.5, 1)';
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

const toRect = (r: DOMRect, shiftY = 0): SpotlightRect => ({
  top: r.top - shiftY,
  left: r.left,
  width: r.width,
  height: r.height,
  bottom: r.bottom - shiftY,
  right: r.right,
});

const sameRect = (a: SpotlightRect | null, b: SpotlightRect) =>
  !!a && Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 &&
  Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

// Contenedor que realmente hace scroll para un elemento (un panel interno o la página)
const getScrollContainer = (elem: HTMLElement): HTMLElement => {
  let node = elem.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return (document.scrollingElement || document.documentElement) as HTMLElement;
};

// Los elementos dentro de una barra fija o pegajosa no se mueven al hacer scroll
const isPinnedToViewport = (elem: HTMLElement, container: HTMLElement) => {
  let node: HTMLElement | null = elem;
  while (node && node !== container && node !== document.body) {
    const position = getComputedStyle(node).position;
    if (position === 'fixed' || position === 'sticky') return true;
    node = node.parentElement;
  }
  return false;
};

interface UseTutorialSpotlightOptions {
  isOpen: boolean;
  stepKey: string | number;
  resolveTarget: () => HTMLElement | null;
  resolveFallback?: () => HTMLElement | null; // Qué enfocar si el elemento del paso no existe en pantalla
  startDelayMs?: number; // Espera previa cuando el paso cambia de pestaña y el contenido aún se está dibujando
}

/**
 * Calcula dónde quedará el elemento del paso DESPUÉS del scroll y mueve el foco una sola vez hacia
 * esa posición final, mientras anima el scroll con la misma duración y curva. Así el foco no
 * persigue un blanco en movimiento (que era lo que producía el temblor).
 */
export function useTutorialSpotlight({ isOpen, stepKey, resolveTarget, resolveFallback, startDelayMs = 0 }: UseTutorialSpotlightOptions) {
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [animate, setAnimate] = useState(false);
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  const resolveRef = useRef(resolveTarget);
  resolveRef.current = resolveTarget;
  const fallbackRef = useRef(resolveFallback);
  fallbackRef.current = resolveFallback;
  const delayRef = useRef(startDelayMs);
  delayRef.current = startDelayMs;
  const elementRef = useRef<HTMLElement | null>(null);
  const scrollingRef = useRef(false);
  const hasRectRef = useRef(false);

  // Mover el foco al elemento del paso actual
  useEffect(() => {
    if (!isOpen) {
      elementRef.current = null;
      hasRectRef.current = false;
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let attempts = 0;

    const focusElement = (elem: HTMLElement) => {
      elementRef.current = elem;
      const rect = elem.getBoundingClientRect();
      const container = getScrollContainer(elem);
      const isPage = container === document.scrollingElement || container === document.documentElement;
      const viewTop = isPage ? 0 : container.getBoundingClientRect().top;
      const viewHeight = isPage ? window.innerHeight : container.clientHeight;

      // Cuánto hay que desplazar para dejar el elemento centrado (o con su inicio visible si es muy alto)
      let delta = 0;
      if (!isPinnedToViewport(elem, container)) {
        const topMargin = isPage ? 96 : 24;
        const desiredTop = rect.height > viewHeight - topMargin - 24
          ? viewTop + topMargin
          : viewTop + Math.max(topMargin, (viewHeight - rect.height) / 2);
        const maxScroll = container.scrollHeight - container.clientHeight;
        const startScroll = container.scrollTop;
        const endScroll = Math.max(0, Math.min(maxScroll, startScroll + (rect.top - desiredTop)));
        delta = endScroll - startScroll;
      }

      // La primera aparición es inmediata; los cambios de paso se animan
      setAnimate(hasRectRef.current);
      hasRectRef.current = true;
      setTargetRect(prev => {
        const next = toRect(rect, delta);
        return sameRect(prev, next) ? prev : next;
      });

      const settle = () => {
        scrollingRef.current = false;
        if (cancelled || !document.body.contains(elem)) return;
        const finalRect = toRect(elem.getBoundingClientRect());
        setTargetRect(prev => (sameRect(prev, finalRect) ? prev : finalRect));
      };

      if (Math.abs(delta) < 1) {
        settle();
        return;
      }

      const startScroll = container.scrollTop;
      const startTime = performance.now();
      scrollingRef.current = true;
      const step = (now: number) => {
        if (cancelled) {
          scrollingRef.current = false;
          return;
        }
        const t = Math.min(1, (now - startTime) / SPOTLIGHT_DURATION_MS);
        container.scrollTo({ top: startScroll + delta * easeOutQuart(t), behavior: 'instant' as ScrollBehavior });
        if (t < 1) {
          frameId = requestAnimationFrame(step);
        } else {
          settle();
        }
      };
      frameId = requestAnimationFrame(step);
    };

    const findTarget = () => {
      if (cancelled) return;
      const elem = resolveRef.current();
      if (elem && elem.getBoundingClientRect().height > 0) {
        focusElement(elem);
      } else if (attempts < 40) {
        attempts++;
        frameId = requestAnimationFrame(findTarget);
      } else {
        const fallback = fallbackRef.current?.();
        if (fallback) {
          focusElement(fallback);
        } else {
          elementRef.current = null;
          hasRectRef.current = false;
          setTargetRect(null);
        }
      }
    };

    const timer = window.setTimeout(findTarget, delayRef.current);

    return () => {
      cancelled = true;
      scrollingRef.current = false;
      window.clearTimeout(timer);
      cancelAnimationFrame(frameId);
    };
  }, [isOpen, stepKey]);

  // Si el usuario hace scroll o cambia el tamaño de la ventana, el foco sigue al elemento sin animación
  useEffect(() => {
    if (!isOpen) return;
    let frameId = 0;

    const realign = () => {
      frameId = 0;
      const elem = elementRef.current;
      if (scrollingRef.current || !elem || !document.body.contains(elem)) return;
      const rect = toRect(elem.getBoundingClientRect());
      setAnimate(false);
      setTargetRect(prev => (sameRect(prev, rect) ? prev : rect));
    };
    const schedule = () => {
      if (!frameId) frameId = requestAnimationFrame(realign);
    };
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      schedule();
    };

    // capture: también detecta el scroll de paneles internos, no solo el de la página
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
    };
  }, [isOpen]);

  return { targetRect, animate, viewport };
}

// Transición de posición para la tarjeta del tutorial (se desactiva cuando el foco solo sigue al scroll)
export const getSpotlightTransition = (animate: boolean, properties: string[]) =>
  animate ? properties.map(p => `${p} ${SPOTLIGHT_DURATION_MS}ms ${SPOTLIGHT_EASING}`).join(', ') : 'none';

interface TutorialSpotlightProps {
  rect: SpotlightRect;
  animate: boolean;
  stepNumber: number;
  viewportWidth: number;
  accent?: 'amber' | 'sky';
  zIndex?: number;
  padding?: number;
}

// Foco recortado sobre el elemento del paso: un solo elemento que oscurece el resto de la pantalla
export const TutorialSpotlight: React.FC<TutorialSpotlightProps> = ({
  rect,
  animate,
  stepNumber,
  viewportWidth,
  accent = 'amber',
  zIndex = 10000,
  padding = 8,
}) => {
  const left = Math.max(0, rect.left - padding);
  const top = Math.max(0, rect.top - padding);
  const width = Math.min(viewportWidth - left, rect.width + padding * 2);
  const glow = accent === 'sky' ? 'rgba(58, 154, 217, 0.45)' : 'rgba(245, 158, 11, 0.35)';

  return (
    <div
      className={`fixed top-0 left-0 pointer-events-none rounded-2xl border-[3px] ${
        accent === 'sky' ? 'border-[#3a9ad9]' : 'border-amber-400 dark:border-amber-300'
      }`}
      style={{
        zIndex,
        width: `${width}px`,
        height: `${rect.height + padding * 2}px`,
        transform: `translate3d(${left}px, ${top}px, 0)`,
        boxShadow: `0 0 0 200vmax rgba(3, 15, 29, 0.8), 0 0 28px ${glow}`,
        transition: getSpotlightTransition(animate, ['transform', 'width', 'height']),
        willChange: 'transform, width, height',
      }}
    >
      <span
        className={`absolute -top-3 -right-3 flex h-6 w-6 rounded-full font-black text-[11px] items-center justify-center font-mono shadow-md border-2 border-white ${
          accent === 'sky' ? 'bg-[#3a9ad9] text-white' : 'bg-amber-500 text-[#092c4c]'
        }`}
      >
        {stepNumber}
      </span>
    </div>
  );
};
