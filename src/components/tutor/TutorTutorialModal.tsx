import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Sparkles, 
  Calendar, 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  ClipboardCheck, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Bell,
  Award
} from 'lucide-react';
import { TutorTab } from '../TutorDashboard';

export interface TutorTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  isLeadTutor?: boolean;
  onNavigateTab?: (tab: TutorTab) => void;
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
  tab?: TutorTab;
}

export const TutorTutorialModal: React.FC<TutorTutorialModalProps> = ({
  isOpen,
  onClose,
  userName = 'Tutor',
  isLeadTutor = false,
  onNavigateTab,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  const popoverRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const isMobile = windowDimensions.width < 768;

  const steps: StepItem[] = useMemo(() => {
    const commonSteps: StepItem[] = [
      {
        id: 'profile',
        targetSelector: '#tutor-profile-summary-card',
        title: isLeadTutor 
          ? `¡Hola ${userName.split(' ')[0]}, bienvenido al Portal Tutor de Tutores!`
          : `¡Hola ${userName.split(' ')[0]}, bienvenido a tu Portal Tutor Par UFT!`,
        badge: isLeadTutor ? '1. Tu Perfil y Liderazgo' : '1. Tu Perfil y Métricas',
        icon: Sparkles,
        accentGradient: isLeadTutor ? 'from-indigo-900 via-indigo-950 to-slate-900' : 'from-[#092c4c] via-[#103a63] to-sky-900',
        tab: 'my_schedule',
        description: isLeadTutor 
          ? 'En esta tarjeta superior puedes verificar tu carrera, rol de liderazgo institucional y el resumen general de tutorías asignadas, alumnos y tutores a cargo.'
          : 'En esta tarjeta superior puedes verificar tu carrera, RUT y el contador en tiempo real de tutorías asignadas y total de alumnos inscritos en tus módulos.',
        tips: [
          'Consulta el resumen de tus tutorías y participantes en cualquier momento.',
          'Haz clic en las métricas para saltar a tus actividades o control de asistencia.'
        ]
      },
      {
        id: 'navbar',
        targetSelector: '#tutor-desktop-nav-bar',
        title: 'Módulos de Gestión y Navegación',
        badge: '2. Barra de Pestañas',
        icon: Award,
        accentGradient: 'from-sky-900 to-indigo-950',
        tab: 'my_schedule',
        description: 'Utiliza la barra superior para alternar rápidamente entre todas las funciones del portal institucional:',
        tips: [
          'Mis Tutorías: Revisa tus clases asignadas y carga tus cronogramas.',
          'Pasar Lista: Registra asistencia presencial u online y proyecta el código QR/PIN.',
          'Cargar Horario & Avisar Inconveniente: Declara tus bloques libres o pide soporte docente.'
        ]
      },
      {
        id: 'my_schedule',
        targetSelector: '#tutor-my-schedule-view',
        title: 'Mis Tutorías y Carga de Cronograma/Temario',
        badge: '3. Gestión de Clases',
        icon: Calendar,
        accentGradient: 'from-sky-900 via-[#092c4c] to-[#103a63]',
        tab: 'my_schedule',
        description: 'Visualiza tus tutorías programadas, fechas, salas asignadas, cupos ocupados y el estado del temario.',
        tips: [
          'Es fundamental cargar o editar el temario antes de cada sesión para que tu cumplimiento sea válido.',
          'Usa el botón de proyección QR/PIN para mostrar el código de asistencia a tus estudiantes en clase.'
        ]
      },
      {
        id: 'attendance',
        targetSelector: '#tutor-attendance-tab',
        title: 'Pasar Lista y Registro de Asistencia',
        badge: '4. Control de Asistencia',
        icon: CheckSquare,
        accentGradient: 'from-emerald-900 via-[#092c4c] to-[#103a63]',
        tab: 'attendance',
        description: 'Pasa lista de manera digital marcando a los alumnos como Presente, Ausente o Justificado en segundos.',
        tips: [
          'Proyecta el código QR o comparte el PIN de 4 dígitos para que los alumnos marquen con su celular.',
          'La asistencia queda sincronizada de inmediato en los registros centrales de la universidad.'
        ]
      },
      {
        id: 'availability',
        targetSelector: '#tutor-availability-view',
        title: 'Declaración de Disponibilidad Horaria',
        badge: '5. Matriz de Horarios',
        icon: Clock,
        accentGradient: 'from-[#092c4c] to-[#153a5c]',
        tab: 'my_availability',
        description: 'Define tus bloques semanales disponibles (Lunes a Viernes de 08:30 a 20:00) para que coordinación te programe tutorías en horarios compatibles.',
        tips: [
          'Marca en verde los bloques donde tienes disponibilidad y presiona "Guardar Disponibilidad".',
          'Puedes actualizar tu disponibilidad cada vez que cambie tu carga académica de pregrado.'
        ]
      },
      {
        id: 'report_issue',
        targetSelector: '#tutor-report-issue-view',
        title: 'Avisar Inconveniente a Coordinación Docente',
        badge: '6. Alertas & Flexibilidad',
        icon: AlertTriangle,
        accentGradient: 'from-amber-900/90 via-[#092c4c] to-slate-900',
        tab: 'report_issue',
        description: '¿Tienes un tope de horario por certamen o imprevisto de fuerza mayor? Envía un aviso formal con propuesta de reasignación a los docentes coordinadores.',
        tips: [
          'Selecciona qué docentes coordinadores recibirán tu mensaje.',
          'Indica tu horario propuesto alternativo o sugiere a otro tutor par para cubrir la sesión.'
        ]
      }
    ];

    // Pasos exclusivos para Tutor de Tutores
    const leadSteps: StepItem[] = isLeadTutor ? [
      {
        id: 'assigned_tutors',
        targetSelector: '#tutor-assigned-tutors-view',
        title: 'Directorio de Tutores a Cargo',
        badge: '7. Supervisión de Tutores',
        icon: ShieldCheck,
        accentGradient: 'from-indigo-900 via-purple-950 to-slate-900',
        tab: 'assigned_tutors',
        description: 'Supervisa la nómina de tutores pares asignados a tu coordinación, sus carreras, ramos dictados y datos de contacto directo.',
        tips: [
          'Consulta el número de sesiones y alumnos atendidos por cada tutor a tu cargo.',
          'Facilita el acompañamiento y apoyo pedagógico continuo entre tutores.'
        ]
      },
      {
        id: 'compliance_review',
        targetSelector: '#tutor-compliance-review-view',
        title: 'Auditoría y Revisión de Cumplimiento',
        badge: '8. Control de Calidad',
        icon: ClipboardCheck,
        accentGradient: 'from-indigo-950 via-[#092c4c] to-slate-900',
        tab: 'compliance_review',
        description: 'Monitorea que cada sesión cumpla con su cronograma previo cargado y el 100% de asistencia registrada.',
        tips: [
          'Filtra por tutor o por estado (Cumplida, Sin cronograma, Inconsistente).',
          'Envía recordatorios masivos o individuales por correo con 1 clic.'
        ]
      }
    ] : [];

    const finalStep: StepItem = {
      id: 'header_actions',
      targetSelector: '#tutor-header-actions-group',
      title: 'Bandeja de Mensajes y Botón de Repetición (!)',
      badge: isLeadTutor ? '9. Centro de Ayuda' : '7. Centro de Ayuda',
      icon: Bell,
      accentGradient: 'from-emerald-800 to-[#092c4c]',
      description: 'En la esquina superior derecha tienes tu bandeja de comunicados, modo oscuro y el botón con signo de exclamación (!) para repetir este tour cuando lo necesites.',
      tips: [
        'Revisa avisos importantes y respuestas de coordinación docente en la campana.',
        'Pulsa el botón (!) en cualquier momento si tienes alguna consulta sobre el portal.'
      ]
    };

    return [...commonSteps, ...leadSteps, finalStep];
  }, [userName, isLeadTutor]);

  const activeStepData = steps[currentStep] || steps[0];

  // Función continua para seguir suavemente el elemento durante la transición de scroll
  const trackTargetElementSmoothly = useCallback((elem: HTMLElement, durationMs = 500) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startTime = performance.now();

    const frame = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      if (elem && document.body.contains(elem)) {
        setTargetRect(elem.getBoundingClientRect());
      }
      if (elapsed < durationMs) {
        animationFrameRef.current = requestAnimationFrame(frame);
      }
    };

    animationFrameRef.current = requestAnimationFrame(frame);
  }, []);

  // Actualizar posición del elemento objetivo INMEDIATAMENTE
  const updateTargetPositionForStep = useCallback((stepIdx: number) => {
    const stepObj = steps[stepIdx];
    if (!stepObj) {
      setTargetRect(null);
      return;
    }

    const selector = stepObj.targetSelector;
    let attempts = 0;
    const maxAttempts = 20;

    const findAndTrack = () => {
      let elem = document.querySelector(selector) as HTMLElement | null;

      // Fallbacks inteligentes si el elemento está en mobile o tiene un ID alternativo
      if (!elem) {
        if (selector === '#tutor-desktop-nav-bar') {
          elem = (document.querySelector('#tutor-mobile-tabs-bar') || document.querySelector('#tutor-header-brand')) as HTMLElement | null;
        } else if (selector === '#tutor-attendance-tab' || selector === '#tutor-attendance-view') {
          elem = (document.querySelector('#tutor-attendance-tab') || document.querySelector('#tutor-attendance-view')) as HTMLElement | null;
        } else if (selector === '#tutor-profile-summary-card') {
          elem = (document.querySelector('#tutor-profile-summary-card') || document.querySelector('#tutor-header-brand') || document.querySelector('#tutor-main-dynamic-card-viewport')) as HTMLElement | null;
        }
      }

      if (elem && elem.getBoundingClientRect().height > 0) {
        const rect = elem.getBoundingClientRect();
        setTargetRect(rect);

        const isHeaderElement = selector === '#tutor-desktop-nav-bar' || selector === '#tutor-header-actions-group' || selector === '#tutor-header-brand';
        
        if (isHeaderElement) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          const headerHeight = 80;
          const rectTop = rect.top;
          const targetScrollTop = window.pageYOffset + rectTop - headerHeight;

          window.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          });
        }

        trackTargetElementSmoothly(elem, 500);
      } else if (attempts < maxAttempts) {
        attempts++;
        requestAnimationFrame(findAndTrack);
      } else {
        const fallbackViewport = document.querySelector('#tutor-main-dynamic-card-viewport') as HTMLElement | null;
        if (fallbackViewport) {
          setTargetRect(fallbackViewport.getBoundingClientRect());
        }
      }
    };

    findAndTrack();
  }, [steps, trackTargetElementSmoothly]);

  // Ejecución INMEDIATA al abrir el tutorial
  useEffect(() => {
    if (isOpen) {
      if (!wasOpenRef.current) {
        setCurrentStep(0);
        wasOpenRef.current = true;
      }
      // Detección instantánea en el tick de apertura
      updateTargetPositionForStep(0);
    } else {
      wasOpenRef.current = false;
      setTargetRect(null);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isOpen, updateTargetPositionForStep]);

  // Manejar cambio de paso y sincronización fluida con pestañas
  useEffect(() => {
    if (!isOpen) return;

    setIsTransitioning(true);
    const stepObj = steps[currentStep];
    if (stepObj?.tab && onNavigateTab) {
      onNavigateTab(stepObj.tab);
    }

    // Ejecutar inmediatamente
    updateTargetPositionForStep(currentStep);

    const timer = setTimeout(() => {
      updateTargetPositionForStep(currentStep);
      setIsTransitioning(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [currentStep, isOpen, onNavigateTab, updateTargetPositionForStep, steps]);

  // Manejo de resize y scroll para mantener alineado el spotlight
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
      if (isOpen) {
        updateTargetPositionForStep(currentStep);
      }
    };

    const handleScroll = () => {
      if (!isOpen) return;
      const stepObj = steps[currentStep];
      if (stepObj) {
        let elem = document.querySelector(stepObj.targetSelector);
        if (!elem && stepObj.targetSelector === '#tutor-desktop-nav-bar') {
          elem = document.querySelector('#tutor-mobile-tabs-bar') || document.querySelector('#tutor-header-brand');
        }
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
  }, [isOpen, currentStep, updateTargetPositionForStep, steps]);

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

  // Cálculo de posición del Popover inteligente (siempre tiende hacia la parte inferior)
  const getPopoverStyle = (): React.CSSProperties => {
    if (isMobile || !targetRect) {
      return {
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '480px',
        zIndex: 10001
      };
    }

    const popoverWidth = 470;
    const padding = 16;
    const popoverEstimatedHeight = 280;

    let top = targetRect.bottom + 14;
    let left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);

    if (left + popoverWidth > windowDimensions.width - padding) {
      left = windowDimensions.width - popoverWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    if (top + popoverEstimatedHeight > windowDimensions.height - padding) {
      top = Math.max(padding, windowDimensions.height - popoverEstimatedHeight - padding);
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
    <div className="fixed inset-0 z-[10000] select-none pointer-events-auto transition-opacity duration-300">
      {/* Fondo oscuro con foco/spotlight recortado y animación ultra-fluida */}
      {targetRect ? (
        <div
          className="fixed pointer-events-none rounded-2xl border-[3px] border-amber-400 dark:border-amber-300 ring-8 ring-amber-400/25 z-[10000]"
          style={{
            top: `${Math.max(0, targetRect.top - 8)}px`,
            left: `${Math.max(0, targetRect.left - 8)}px`,
            width: `${Math.min(windowDimensions.width, targetRect.width + 16)}px`,
            height: `${targetRect.height + 16}px`,
            boxShadow: '0 0 0 9999px rgba(3, 15, 29, 0.82), 0 0 30px rgba(245, 158, 11, 0.35)',
            transition: 'top 450ms cubic-bezier(0.25, 1, 0.5, 1), left 450ms cubic-bezier(0.25, 1, 0.5, 1), width 450ms cubic-bezier(0.25, 1, 0.5, 1), height 450ms cubic-bezier(0.25, 1, 0.5, 1)'
          }}
        >
          {/* Indicador de paso en esquina del spotlight */}
          <span className="absolute -top-3 -right-3 flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-6 w-6 bg-amber-500 text-[#092c4c] font-black text-[11px] items-center justify-center font-mono shadow-md border-2 border-white">
              {currentStep + 1}
            </span>
          </span>
        </div>
      ) : (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity duration-400 z-[10000]" 
          onClick={onClose}
        />
      )}

      {/* Tarjeta Flotante Explicativa con Foco y Transición Suave */}
      <div
        ref={popoverRef}
        style={{
          ...getPopoverStyle(),
          transition: 'top 450ms cubic-bezier(0.25, 1, 0.5, 1), left 450ms cubic-bezier(0.25, 1, 0.5, 1), opacity 300ms ease-out, transform 300ms ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-amber-400/60 dark:border-amber-400/50 overflow-hidden flex flex-col will-change-transform"
      >
        {/* Cabecera del Paso con degradado */}
        <div className={`bg-gradient-to-r ${activeStepData.accentGradient} p-3.5 sm:p-4 text-white relative transition-colors duration-400`}>
          {/* Botón de Parar / Cerrar tutorial */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/15 hover:bg-white/30 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Parar / Salir del Tutorial"
            aria-label="Cerrar tutorial"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-amber-400 text-[#092c4c] shadow-xs">
              {activeStepData.badge}
            </span>
            <span className="text-[10px] text-slate-300 font-bold font-mono">
              Paso {currentStep + 1} de {steps.length}
            </span>
          </div>

          <div className="flex items-center gap-2.5 pr-6">
            <div className="p-2 bg-white/10 rounded-xl border border-white/20 text-amber-300 shrink-0 shadow-xs transition-transform duration-300 hover:rotate-6">
              <StepIcon className="w-4.5 h-4.5" />
            </div>
            <h3 className="text-xs sm:text-sm font-extrabold tracking-tight leading-snug">
              {activeStepData.title}
            </h3>
          </div>
        </div>

        {/* Barra de progreso fluida */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 flex overflow-hidden">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-full flex-1 transition-all duration-500 ease-out ${
                idx <= currentStep 
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                  : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* Contenido explicativo del paso con micro-animación de entrada */}
        <div 
          key={currentStep}
          className={`p-3.5 sm:p-4 space-y-2.5 text-slate-700 dark:text-slate-200 text-xs leading-relaxed max-h-[35vh] overflow-y-auto transition-all duration-300 ${
            isTransitioning ? 'opacity-40 translate-y-1' : 'opacity-100 translate-y-0'
          }`}
        >
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-[11.5px] sm:text-xs">
            {activeStepData.description}
          </p>

          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5 shadow-2xs">
            {activeStepData.tips.map((tip, tIdx) => (
              <div key={tIdx} className="flex items-start gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-400 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                  ✓
                </span>
                <span className="text-slate-700 dark:text-slate-300 text-[10.5px] sm:text-[11px] leading-tight">
                  {tip}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pie de navegación con controles de paso y parada */}
        <div className="p-3 bg-slate-50/90 dark:bg-slate-850/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          {/* Indicadores de bolitas */}
          <div className="flex items-center gap-1">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentStep(idx);
                }}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentStep
                    ? 'w-5 bg-amber-500 dark:bg-amber-400 shadow-xs'
                    : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
                title={`Ir al paso ${idx + 1}`}
              />
            ))}
          </div>

          {/* Botones de acción con micro-interacciones */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer active:scale-95"
            >
              Parar
            </button>

            {currentStep > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentStep(prev => Math.max(0, prev - 1));
                }}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isLastStep) {
                  onClose();
                } else {
                  setCurrentStep(prev => prev + 1);
                }
              }}
              className="px-3.5 py-1.5 bg-[#092c4c] dark:bg-amber-400 hover:bg-[#153a5c] dark:hover:bg-amber-300 text-white dark:text-[#092c4c] text-[11px] font-black rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer hover:scale-[1.02] active:scale-95"
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
