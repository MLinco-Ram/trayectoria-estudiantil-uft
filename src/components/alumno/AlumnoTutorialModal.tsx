import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, 
  Award, 
  BookOpen, 
  QrCode, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  ChevronLeft,
  GraduationCap,
  Bell,
  Info
} from 'lucide-react';

export interface AlumnoTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  onNavigateTab?: (tab: 'tutorias' | 'psicoeducativo' | 'my_bookings' | 'history' | 'inconvenientes') => void;
}

interface StepItem {
  id: string;
  targetSelector: string;
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  accentGradient: string;
  description: string;
  tips: string[];
  tab?: 'tutorias' | 'psicoeducativo' | 'my_bookings' | 'history' | 'inconvenientes';
  preferredPlacement?: 'bottom' | 'top' | 'center';
}

export const AlumnoTutorialModal: React.FC<AlumnoTutorialModalProps> = ({
  isOpen,
  onClose,
  userName = 'Estudiante',
  onNavigateTab,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  const steps: StepItem[] = [
    {
      id: 'profile',
      targetSelector: '#student-main-profile-card',
      title: `¡Hola ${userName.split(' ')[0]}, bienvenido a tu Portal UFT!`,
      badge: '1. Tu Perfil y Métricas',
      icon: Sparkles,
      accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
      tab: 'tutorias',
      description: 'En esta tarjeta superior puedes verificar tu carrera, RUT y el contador de reservas semanales activas y asistencias acumuladas.',
      tips: [
        'Consulta cuántos cupos semanales tienes disponibles.',
        'Haz clic en las métricas para saltar a tus reservas o historial.'
      ],
      preferredPlacement: 'bottom'
    },
    {
      id: 'navbar',
      targetSelector: '#alumno-desktop-nav-bar',
      title: 'Módulos de Apoyo y Navegación',
      badge: '2. Menú de Pestañas',
      icon: Award,
      accentGradient: 'from-sky-900 to-indigo-950',
      tab: 'tutorias',
      description: 'Navega fácilmente entre todas las modalidades de aprendizaje que la UFT tiene para ti:',
      tips: [
        'Tutorías Colectivas: Sesiones de reforzamiento por ramo con tutores pares.',
        'Talleres Psicoeducativos: Habilidades de estudio y manejo del tiempo.',
        'Mis Reservas, Historial y Solicitudes de Inconveniente.'
      ],
      preferredPlacement: 'bottom'
    },
    {
      id: 'dates',
      targetSelector: '#alumno-date-picker-card',
      title: 'Selector de Días y Calendario',
      badge: '3. Fechas y Horarios',
      icon: Calendar,
      accentGradient: 'from-[#092c4c] to-[#153a5c]',
      tab: 'tutorias',
      description: 'Elige qué día deseas consultar: pulsa directamente sobre los accesos rápidos (Hoy, Mañana, etc.) o elige una fecha específica en el calendario.',
      tips: [
        'Las fechas con sesiones programadas se destacan visualmente.',
        'Puedes buscar y reservar tutorías con anticipación.'
      ],
      preferredPlacement: 'bottom'
    },
    {
      id: 'catalog',
      targetSelector: '#academic-visual-slots-grid',
      title: 'Módulos de Tutorías y Reserva Inmediata',
      badge: '4. Inscripción con 1 Clic',
      icon: GraduationCap,
      accentGradient: 'from-emerald-900 via-[#092c4c] to-[#103a63]',
      tab: 'tutorias',
      description: 'Cada tarjeta muestra el horario, tutor responsable, cupos disponibles, aula y el temario/cronograma preparado para la sesión.',
      tips: [
        'Revisa el temario antes de reservar para saber qué se trabajará.',
        'Presiona "Inscribirme" para asegurar tu cupo de inmediato.'
      ],
      preferredPlacement: 'top'
    },
    {
      id: 'attendance',
      targetSelector: '#alumno-mobile-qr-section',
      title: 'Asistencia Digital con QR y PIN',
      badge: '5. Control de Asistencia',
      icon: QrCode,
      accentGradient: 'from-indigo-900 to-[#092c4c]',
      tab: 'my_bookings',
      description: 'Al llegar a tu tutoría, el tutor proyectará un código QR y un PIN de 4 dígitos para registrar tu asistencia de forma automática.',
      tips: [
        'Usa el botón central de la cámara para escanear el QR.',
        'También puedes ingresar el PIN de 4 dígitos si no dispones de cámara.'
      ],
      preferredPlacement: 'top'
    },
    {
      id: 'inconvenientes',
      targetSelector: '#alumno-inconvenientes-form-container',
      title: 'Avisos de Inconveniente y Tope de Horario',
      badge: '6. Flexibilidad y Contacto',
      icon: AlertTriangle,
      accentGradient: 'from-amber-900/90 via-[#092c4c] to-slate-900',
      tab: 'inconvenientes',
      description: '¿Tienes un tope de horario o problema de fuerza mayor? Envía un aviso formal a los docentes coordinadores para coordinar una sesión flexible individual.',
      tips: [
        'Indica tu horario de disponibilidad propuesto.',
        'Se notificará automáticamente a la coordinación y al tutor asignado.'
      ],
      preferredPlacement: 'top'
    },
    {
      id: 'header_actions',
      targetSelector: '#alumno-header-actions-group',
      title: 'Bandeja de Correo y Botón de Repetición (!)',
      badge: '7. Centro de Ayuda',
      icon: Bell,
      accentGradient: 'from-emerald-800 to-[#092c4c]',
      description: 'En la esquina superior derecha tienes tu bandeja de comunicados, modo oscuro y el botón con signo de exclamación (!) para volver a abrir este tutorial.',
      tips: [
        'Revisa avisos importantes y cambios de horario en la campana.',
        'Haz clic en el botón (!) en cualquier momento si tienes dudas.'
      ],
      preferredPlacement: 'bottom'
    }
  ];

  const activeStepData = steps[currentStep];

  // Actualizar posición del elemento seleccionado
  const updateTargetPosition = useCallback(() => {
    if (!isOpen) return;

    const selector = activeStepData?.targetSelector;
    if (!selector) {
      setTargetRect(null);
      return;
    }

    let elem = document.querySelector(selector) as HTMLElement | null;

    // Si no se encuentra en mobile, intentar fallback de la barra
    if (!elem && selector === '#alumno-desktop-nav-bar') {
      elem = document.querySelector('#student-main-profile-card') as HTMLElement | null;
    }

    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const rect = elem.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isOpen, activeStepData]);

  // Sincronizar dimensiones de pantalla y scroll
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
      updateTargetPosition();
    };

    const handleScroll = () => {
      if (!isOpen) return;
      const selector = activeStepData?.targetSelector;
      if (selector) {
        const elem = document.querySelector(selector);
        if (elem) {
          setTargetRect(elem.getBoundingClientRect());
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen, activeStepData, updateTargetPosition]);

  // Cambiar pestaña si el paso lo requiere y reposicionar
  useEffect(() => {
    if (!isOpen) return;

    if (activeStepData.tab && onNavigateTab) {
      onNavigateTab(activeStepData.tab);
    }

    // Esperar renderizado del DOM de la pestaña
    const timer = setTimeout(() => {
      updateTargetPosition();
    }, 180);

    return () => clearTimeout(timer);
  }, [currentStep, isOpen, activeStepData, onNavigateTab, updateTargetPosition]);

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      const timer = setTimeout(() => {
        updateTargetPosition();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, updateTargetPosition]);

  // Teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        setCurrentStep(prev => prev - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, steps.length, onClose]);

  if (!isOpen) return null;

  const isLastStep = currentStep === steps.length - 1;
  const StepIcon = activeStepData.icon;

  // Cálculo de posición del Popover inteligente
  const getPopoverStyle = (): React.CSSProperties => {
    const isMobile = windowDimensions.width < 768;
    
    if (isMobile || !targetRect) {
      return {
        position: 'fixed',
        bottom: isMobile ? '16px' : 'auto',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '480px',
        zIndex: 10001
      };
    }

    const popoverWidth = 460;
    const padding = 16;
    const popoverHeight = 340;

    let top = targetRect.bottom + 16;
    let left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);

    // Si queda fuera por la derecha o izquierda
    if (left + popoverWidth > windowDimensions.width - padding) {
      left = windowDimensions.width - popoverWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    // Si queda fuera por abajo, colocarlo arriba del elemento
    if (top + popoverHeight > windowDimensions.height - padding || activeStepData.preferredPlacement === 'top') {
      top = Math.max(padding, targetRect.top - popoverHeight - 16);
    }

    return {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${popoverWidth}px`,
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 10001
    };
  };

  return (
    <div className="fixed inset-0 z-[10000] select-none pointer-events-auto">
      {/* Fondo oscuro con foco/spotlight recortado */}
      {targetRect ? (
        <>
          {/* Spotlight Highlight Box con aro de brillo y sombra de 9999px */}
          <div
            className="fixed pointer-events-none rounded-2xl transition-all duration-300 ease-out border-[3px] border-amber-400 dark:border-amber-300 ring-8 ring-amber-400/25 z-[10000]"
            style={{
              top: `${Math.max(0, targetRect.top - 8)}px`,
              left: `${Math.max(0, targetRect.left - 8)}px`,
              width: `${Math.min(windowDimensions.width, targetRect.width + 16)}px`,
              height: `${targetRect.height + 16}px`,
              boxShadow: '0 0 0 9999px rgba(3, 15, 29, 0.82)'
            }}
          >
            {/* Indicador pulsante en esquina del spotlight */}
            <span className="absolute -top-3 -right-3 flex h-6 w-6">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-6 w-6 bg-amber-500 text-[#092c4c] font-black text-[11px] items-center justify-center font-mono shadow-md border-2 border-white">
                !
              </span>
            </span>
          </div>
        </>
      ) : (
        /* Backdrop completo si no hay elemento target disponible */
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity duration-300 z-[10000]" 
          onClick={onClose}
        />
      )}

      {/* Tarjeta Flotante Explicativa con Foco */}
      <div
        ref={popoverRef}
        style={getPopoverStyle()}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-amber-400/60 dark:border-amber-400/50 overflow-hidden flex flex-col transition-all duration-300 animate-scale-in"
      >
        {/* Cabecera del Paso */}
        <div className={`bg-gradient-to-r ${activeStepData.accentGradient} p-4 sm:p-5 text-white relative`}>
          {/* Botón de Parar / Cerrar tutorial */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/15 hover:bg-white/30 text-white transition-all cursor-pointer"
            title="Parar / Salir del Tutorial"
            aria-label="Cerrar tutorial"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-400 text-[#092c4c] shadow-xs">
              {activeStepData.badge}
            </span>
            <span className="text-[11px] text-slate-300 font-bold font-mono">
              Paso {currentStep + 1} de {steps.length}
            </span>
          </div>

          <div className="flex items-center gap-3 pr-6">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 text-amber-300 shrink-0 shadow-xs">
              <StepIcon className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold tracking-tight leading-snug">
              {activeStepData.title}
            </h3>
          </div>
        </div>

        {/* Barra de progreso interactiva */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 flex">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-full flex-1 transition-all duration-300 ${
                idx <= currentStep 
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                  : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* Contenido explicativo del paso con foco */}
        <div className="p-4 sm:p-5 space-y-3 text-slate-700 dark:text-slate-200 text-xs leading-relaxed max-h-[42vh] overflow-y-auto">
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs sm:text-[13px]">
            {activeStepData.description}
          </p>

          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
            {activeStepData.tips.map((tip, tIdx) => (
              <div key={tIdx} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  ✓
                </span>
                <span className="text-slate-700 dark:text-slate-300 text-[11px] sm:text-xs">
                  {tip}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pie de navegación con controles de paso y parada */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          {/* Indicadores de bolitas */}
          <div className="flex items-center gap-1">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStep
                    ? 'w-5 bg-amber-500 dark:bg-amber-400'
                    : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
                title={`Ir al paso ${idx + 1}`}
              />
            ))}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg transition cursor-pointer"
            >
              Parar
            </button>

            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isLastStep) {
                  onClose();
                } else {
                  setCurrentStep(prev => prev + 1);
                }
              }}
              className="px-3.5 py-1.5 bg-[#092c4c] dark:bg-amber-400 hover:bg-[#153a5c] dark:hover:bg-amber-300 text-white dark:text-[#092c4c] text-[11px] font-black rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
            >
              <span>{isLastStep ? '¡Listo, comenzar!' : 'Siguiente'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-amber-400 dark:text-[#092c4c]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
