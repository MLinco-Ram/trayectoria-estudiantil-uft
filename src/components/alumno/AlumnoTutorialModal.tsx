import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Sparkles, 
  Award, 
  QrCode, 
  Calendar, 
  AlertTriangle, 
  X, 
  ChevronRight, 
  ChevronLeft,
  GraduationCap,
  Bell,
  Grid
} from 'lucide-react';
import { useTutorialSpotlight, TutorialSpotlight, getSpotlightTransition } from '../common/tutorialSpotlight';

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
}

export const AlumnoTutorialModal: React.FC<AlumnoTutorialModalProps> = ({
  isOpen,
  onClose,
  userName = 'Estudiante',
  onNavigateTab,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const steps: StepItem[] = useMemo(() => {
    const commonFirstFour: StepItem[] = [
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
        ]
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
        ]
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
        ]
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
        ]
      }
    ];

    // Paso 5: Diferenciado entre Escritorio y Móvil
    const stepFive: StepItem = isMobile
      ? {
          id: 'attendance_mobile',
          targetSelector: '#alumno-mobile-qr-section',
          title: 'Asistencia Digital con QR y PIN',
          badge: '5. Escáner QR de Asistencia',
          icon: QrCode,
          accentGradient: 'from-indigo-900 to-[#092c4c]',
          tab: 'my_bookings',
          description: 'Al llegar a tu tutoría, utiliza el botón central de escaneo con cámara para leer el código QR que proyectará tu tutor y validar tu asistencia al instante.',
          tips: [
            'Usa el botón central de la cámara para escanear el código QR.',
            'También puedes ingresar el PIN de 4 dígitos si no dispones de cámara.'
          ]
        }
      : {
          id: 'bookings_desktop',
          targetSelector: '#alumno-my-bookings-container',
          title: 'Mis Reservas y Seguimiento de Clases',
          badge: '5. Mis Reservas',
          icon: Grid,
          accentGradient: 'from-indigo-900 to-[#092c4c]',
          tab: 'my_bookings',
          description: 'En esta pestaña podrás gestionar todas tus tutorías y talleres confirmados, consultar salas asignadas, enlaces, temarios y cancelar oportunamente.',
          tips: [
            'Revisa los detalles y salas de cada clase que tienes reservada.',
            'Si no podrás asistir, cancela con tiempo para liberar el cupo.',
            'El tutor registrará tu asistencia en el sistema durante la sesión.'
          ]
        };

    const commonLastTwo: StepItem[] = [
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
        ]
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
        ]
      }
    ];

    return [...commonFirstFour, stepFive, ...commonLastTwo];
  }, [userName, isMobile]);

  const activeStepData = steps[currentStep] || steps[0];

  // Foco sobre el elemento del paso: se mueve una sola vez, sincronizado con el scroll
  const { targetRect, animate, viewport: windowDimensions } = useTutorialSpotlight({
    isOpen,
    stepKey: currentStep,
    startDelayMs: activeStepData?.tab && onNavigateTab ? 80 : 0,
    resolveTarget: () => {
      const stepObj = steps[currentStep];
      if (!stepObj) return null;
      const selector = stepObj.targetSelector;
      return (document.querySelector(selector) ||
        (selector === '#alumno-desktop-nav-bar' ? document.querySelector('#student-main-profile-card') : null)) as HTMLElement | null;
    },
  });

  // Reset del paso SOLAMENTE cuando isOpen cambia de false a true
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setCurrentStep(0);
      wasOpenRef.current = true;
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  // Al cambiar de paso, abrir la pestaña que ese paso explica
  useEffect(() => {
    if (!isOpen) return;
    const stepObj = steps[currentStep];
    if (stepObj?.tab && onNavigateTab) {
      onNavigateTab(stepObj.tab);
    }
  }, [currentStep, isOpen, onNavigateTab, steps]);

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

  // Cálculo de posición del Popover con curvatura y límites
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
      top: 0,
      left: 0,
      transform: `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`,
      width: `${popoverWidth}px`,
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 10001
    };
  };

  return (
    <div className="fixed inset-0 z-[10000] select-none pointer-events-auto transition-opacity duration-300">
      {/* Fondo oscuro con foco recortado sobre el elemento del paso */}
      {targetRect ? (
        <TutorialSpotlight
          rect={targetRect}
          animate={animate}
          stepNumber={currentStep + 1}
          viewportWidth={windowDimensions.width}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/80 z-[10000]" onClick={onClose} />
      )}

      {/* Tarjeta Flotante Explicativa con Foco y Transición Suave */}
      <div
        ref={popoverRef}
        style={{
          ...getPopoverStyle(),
          transition: getSpotlightTransition(animate && !isMobile, ['transform'])
        }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-amber-400/60 dark:border-amber-400/50 overflow-hidden flex flex-col will-change-transform"
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
          className="p-3.5 sm:p-4 space-y-2.5 text-slate-700 dark:text-slate-200 text-xs leading-relaxed max-h-[35vh] overflow-y-auto animate-step-in"
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
