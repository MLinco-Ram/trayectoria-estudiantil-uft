import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Award, 
  BookOpen, 
  Search, 
  QrCode, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  ChevronLeft,
  GraduationCap,
  Grid,
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
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  description: string;
  bullets: string[];
  tab?: 'tutorias' | 'psicoeducativo' | 'my_bookings' | 'history' | 'inconvenientes';
}

export const AlumnoTutorialModal: React.FC<AlumnoTutorialModalProps> = ({
  isOpen,
  onClose,
  userName = 'Estudiante',
  onNavigateTab,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps: StepItem[] = [
    {
      id: 'welcome',
      title: `¡Hola ${userName.split(' ')[0]}, bienvenido a tu Portal UFT!`,
      badge: 'Bienvenida',
      icon: Sparkles,
      accentColor: 'from-[#092c4c] via-[#103a63] to-sky-900',
      description: 'Este portal es tu espacio institucional para potenciar tu rendimiento académico, resolver dudas de tus ramos y participar en talleres de aprendizaje.',
      bullets: [
        'Inscripción gratuita a tutorías individuales y grupales entre pares.',
        'Talleres de acompañamiento psicoeducativo y métodos de estudio.',
        'Registro de asistencia digital con código QR o código PIN.',
        'Gestión de solicitudes y aviso de inconvenientes con tus horarios.'
      ]
    },
    {
      id: 'programs',
      title: 'Tutorías Académicas y Talleres Psicoeducativos',
      badge: 'Pestañas Principales',
      icon: Award,
      accentColor: 'from-sky-900 to-indigo-950',
      tab: 'tutorias',
      description: 'En la barra superior encontrarás las distintas modalidades de acompañamiento que la universidad pone a tu disposición:',
      bullets: [
        'Tutorías Colectivas: Clases de reforzamiento dictadas por tutores estudiantes pares en ramos clave.',
        'Talleres Psicoeducativos: Sesiones sobre gestión del tiempo, manejo de ansiedad y técnicas de estudio dirigidas por el CAA.',
        'Navega entre las pestañas para ver los horarios semanales de cada área.'
      ]
    },
    {
      id: 'filters',
      title: 'Buscador y Filtros por Carrera o Ramo',
      badge: 'Búsqueda Rápida',
      icon: Search,
      accentColor: 'from-[#092c4c] to-[#153a5c]',
      tab: 'tutorias',
      description: 'Encuentra en segundos la clase exacta que necesitas utilizando los filtros interactivos:',
      bullets: [
        'Filtro por Carrera: Muestra únicamente las sesiones creadas para tu plan de estudios.',
        'Selector de Fecha: Explora los bloques del día de hoy, mañana o días futuros.',
        'Barra de Búsqueda: Escribe el nombre del ramo, contenido del temario o nombre del tutor.'
      ]
    },
    {
      id: 'booking',
      title: 'Inscripción y Temarios con 1 Clic',
      badge: 'Inscripción',
      icon: GraduationCap,
      accentColor: 'from-emerald-900 via-[#092c4c] to-[#103a63]',
      tab: 'tutorias',
      description: 'Cada tarjeta de tutoría contiene toda la información necesaria antes de inscribirte:',
      bullets: [
        'Revisa el temario/cronograma preparado por el tutor para esa clase.',
        'Consulta el número de cupos disponibles y el aula o modalidad (sala u online).',
        'Presiona "Inscribirme" para asegurar tu lugar. Recibirás un correo con la confirmación.'
      ]
    },
    {
      id: 'attendance',
      title: 'Mis Reservas y Asistencia con QR / PIN',
      badge: 'Control de Asistencia',
      icon: QrCode,
      accentColor: 'from-indigo-900 to-[#092c4c]',
      tab: 'my_bookings',
      description: 'En la pestaña "Mis Reservas" podrás dar seguimiento a todas tus clases activas y pasar lista:',
      bullets: [
        'Escáner QR: Escanea el código que tu tutor proyectará en la sala para registrar tu presencia al instante.',
        'Código PIN: Si no tienes cámara disponible, puedes ingresar el PIN numérico de 4 dígitos.',
        'Cancelación oportuna: Si no podrás asistir, libera tu cupo para que otro compañero lo aproveche.'
      ]
    },
    {
      id: 'issues',
      title: 'Historial, Encuestas y Avisos de Inconveniente',
      badge: 'Feedback y Solicitudes',
      icon: AlertTriangle,
      accentColor: 'from-amber-900/90 via-[#092c4c] to-slate-900',
      tab: 'inconvenientes',
      description: 'Tu opinión y flexibilidad son fundamentales para el programa de acompañamiento:',
      bullets: [
        'Historial de Tutorías: Evalúa la clase y deja tus comentarios al finalizar para que sigamos mejorando.',
        'Avisar Inconveniente: Si tienes tope de horario o problemas de fuerza mayor, envía una alerta al docente coordinador para solicitar un horario flexible individual.'
      ]
    },
    {
      id: 'ready',
      title: '¡Ya estás listo para comenzar!',
      badge: 'Todo Listo',
      icon: CheckCircle2,
      accentColor: 'from-emerald-800 to-[#092c4c]',
      description: 'Aprovecha al máximo todas las herramientas que la Dirección de Trayectoria Estudiantil tiene para ti.',
      bullets: [
        'Puedes volver a abrir este tutorial en cualquier momento haciendo clic en el botón con signo de exclamación (!) ubicado en la barra superior junto a tu nombre.',
        '¡Mucho éxito en tus clases y tutorías este semestre!'
      ]
    }
  ];

  const activeStepData = steps[currentStep];

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeStepData.tab && onNavigateTab) {
      onNavigateTab(activeStepData.tab);
    }
  }, [currentStep, isOpen]);

  // Manejador de teclado para navegación y cierre
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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-xs animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-modal-title"
    >
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-all transform animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con degradado institucional */}
        <div className={`bg-gradient-to-r ${activeStepData.accentColor} p-6 sm:p-7 text-white relative transition-all duration-300`}>
          {/* Botón de Parar / Cerrar tutorial */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all cursor-pointer"
            title="Cerrar / Omitir Tutorial"
            aria-label="Cerrar tutorial"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2.5">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-xs border border-white/20 text-white">
              {activeStepData.badge}
            </span>
            <span className="text-xs text-slate-300 font-medium font-mono">
              Paso {currentStep + 1} de {steps.length}
            </span>
          </div>

          <div className="flex items-start gap-3.5 pr-8">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/20 text-white shrink-0 mt-0.5 shadow-xs">
              <StepIcon className="w-6 h-6 text-[#3a9ad9]" />
            </div>
            <div>
              <h3 id="tutorial-modal-title" className="text-lg sm:text-xl font-extrabold tracking-tight leading-snug">
                {activeStepData.title}
              </h3>
            </div>
          </div>
        </div>

        {/* Barra de progreso interactiva */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 flex">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-full flex-1 transition-all duration-300 ${
                idx <= currentStep 
                  ? 'bg-gradient-to-r from-[#092c4c] to-[#3a9ad9]' 
                  : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* Contenido explicativo del paso */}
        <div className="p-6 sm:p-7 space-y-4 text-slate-700 dark:text-slate-200 text-xs sm:text-sm leading-relaxed overflow-y-auto max-h-[60vh]">
          <p className="font-medium text-slate-800 dark:text-slate-100">
            {activeStepData.description}
          </p>

          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
            {activeStepData.bullets.map((bullet, bIdx) => (
              <div key={bIdx} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#3a9ad9]/20 text-[#092c4c] dark:text-[#3a9ad9] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  ✓
                </span>
                <span className="text-slate-700 dark:text-slate-300 text-xs leading-normal">
                  {bullet}
                </span>
              </div>
            ))}
          </div>

          {currentStep === 0 && (
            <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl text-[11px] text-sky-900 dark:text-sky-200 flex items-center gap-2">
              <Info className="w-4 h-4 text-[#3a9ad9] shrink-0" />
              <span>Puedes avanzar con las flechas del teclado o pulsar <strong>Omitir</strong> si prefieres explorar libremente.</span>
            </div>
          )}
        </div>

        {/* Pie de navegación con botones y opción de parar */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Indicadores de bolitas clicables */}
          <div className="flex items-center gap-1.5 order-2 sm:order-1">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStep(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStep
                    ? 'w-6 bg-[#092c4c] dark:bg-[#3a9ad9]'
                    : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
                title={`Ir al paso ${idx + 1}`}
                aria-label={`Ir al paso ${idx + 1}`}
              />
            ))}
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end order-1 sm:order-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl transition cursor-pointer"
            >
              Parar / Omitir
            </button>

            {currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
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
              className="px-5 py-2 bg-[#092c4c] hover:bg-[#153a5c] text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
            >
              <span>{isLastStep ? '¡Comenzar a Usar!' : 'Siguiente'}</span>
              <ChevronRight className="w-4 h-4 text-[#3a9ad9]" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
