import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Sparkles, 
  Calendar, 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  PlusCircle, 
  Inbox, 
  BookOpen, 
  Users, 
  Send, 
  TrendingUp, 
  MessageSquare, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Info,
  Layers,
  BarChart3,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { useTutorialSpotlight, TutorialSpotlight, getSpotlightTransition } from '../common/tutorialSpotlight';
import { DocenteTabType } from './DocenteSidebar';

export interface DocenteTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: DocenteTabType;
  userName?: string;
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
}

export const DocenteTutorialModal: React.FC<DocenteTutorialModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  userName = 'Docente',
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const popoverRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  // Pasos específicos de cada apartado (Mini-Tutoriales modulares)
  const stepsByTab: Record<DocenteTabType, StepItem[]> = useMemo(() => ({
    rooms: [
      {
        id: 'rooms-header',
        targetSelector: '#docente-rooms-header',
        title: 'Catálogo de Salas',
        badge: 'Paso 1 de 1 • Salas',
        icon: Sparkles,
        accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
        description: 'Registra las salas disponibles con un código corto (ej: B405, B-101, Trayectorias) y una descripción opcional. Al crear una sesión se elige la sala de esta lista y el sistema impide asignar la misma sala a dos sesiones en el mismo horario.',
        tips: [
          'Usa la descripción para indicar qué es o dónde está la sala (ej: Amberes Sur B - 1).',
          'Una sala con sesiones activas no se puede eliminar.'
        ]
      }
    ],
    calendar: [
      {
        id: 'calendar-header',
        targetSelector: '#docente-calendar-header',
        title: 'Agenda y Calendario General de Tutorías',
        badge: 'Paso 1 de 3 • Resumen y Métricas',
        icon: Calendar,
        accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
        description: 'Visualiza en tiempo real el cronograma completo de tutorías académicas y talleres psicoeducativos programados en la universidad.',
        tips: [
          'Consulta los contadores rápidos de sesiones activas, tutorías pares y talleres.',
          'Revisa el estado de cupos y salas asignadas en tiempo real.'
        ]
      },
      {
        id: 'calendar-filters',
        targetSelector: '#docente-calendar-filters',
        title: 'Filtros y Búsqueda Rápida',
        badge: 'Paso 2 de 3 • Filtrado Avanzado',
        icon: Sparkles,
        accentGradient: 'from-sky-900 to-indigo-950',
        description: 'Encuentra al instante cualquier sesión buscando por asignatura, sala o nombre del tutor, o segmenta por programa académico.',
        tips: [
          'Usa el buscador para localizar tutorías específicas por palabra clave.',
          'Filtra por tutor individual para revisar la carga horaria asignada.'
        ]
      },
      {
        id: 'calendar-modes-and-grid',
        targetSelector: '#docente-calendar-view-modes',
        title: 'Modalidades de Visualización',
        badge: 'Paso 3 de 3 • Navegación Temporal',
        icon: Layers,
        accentGradient: 'from-[#092c4c] via-[#153a5c] to-cyan-900',
        description: 'Alterna con un clic entre la cuadrícula semanal por bloques, el calendario mensual interactivo o la vista de lista compacta.',
        tips: [
          'Haz clic en cualquier sesión para ver los alumnos inscritos y detalles del temario.',
          'Usa las flechas de navegación para moverte entre semanas anteriores o futuras.'
        ]
      }
    ],
    create: [
      {
        id: 'create-program',
        targetSelector: '#docente-create-program-selector',
        title: 'Programa y Modalidad de la Sesión',
        badge: 'Paso 1 de 3 • Tipo de Actividad',
        icon: PlusCircle,
        accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
        description: 'Selecciona si vas a programar una tutoría académica de carrera o un taller/asesoría del programa de apoyo psicoeducativo.',
        tips: [
          'Tutorías grupales tienen cupos automáticos de hasta 15 estudiantes.',
          'Tutorías personalizadas (1 a 1) reservan cupo exclusivo para un estudiante.'
        ]
      },
      {
        id: 'create-details',
        targetSelector: '#docente-create-form-fields',
        title: 'Detalles, Asignatura y Horario',
        badge: 'Paso 2 de 3 • Configuración',
        icon: Clock,
        accentGradient: 'from-sky-900 to-indigo-950',
        description: 'Define el título descriptivo, ramo, fecha de realización, bloque horario institucional y la sala o cubículo asignado.',
        tips: [
          'Elige títulos claros para que los estudiantes los identifiquen fácilmente.',
          'Los horarios siguen los bloques oficiales de la Universidad Finis Terrae.'
        ]
      },
      {
        id: 'create-tutor',
        targetSelector: '#docente-create-tutor-select',
        title: 'Asignación de Tutor y Disponibilidad en Vivo',
        badge: 'Paso 3 de 3 • Confirmación',
        icon: CheckCircle2,
        accentGradient: 'from-emerald-950 via-[#092c4c] to-sky-900',
        description: 'El sistema valida automáticamente qué tutores tienen disponibilidad declarada en el día y bloque elegido para asignarlos con total seguridad.',
        tips: [
          'La insignia verde indica que el tutor confirmó disponibilidad en ese horario.',
          'Al guardar, se enviará una notificación automática al tutor y se publicará en el explorador de alumnos.'
        ]
      }
    ],
    attendance: [
      {
        id: 'attendance-controls',
        targetSelector: '#docente-attendance-controls',
        title: 'Selección de Fecha y Sesión',
        badge: 'Paso 1 de 3 • Búsqueda de Clase',
        icon: Calendar,
        accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
        description: 'Elige la fecha y localiza rápidamente la sesión de tutoría sobre la cual deseas registrar o supervisar la asistencia.',
        tips: [
          'Puedes usar el selector de fecha o ver todas las sesiones activas.',
          'Filtra por nombre de asignatura o tutor para agilizar la búsqueda.'
        ]
      },
      {
        id: 'attendance-qr',
        targetSelector: '#docente-attendance-qr-action',
        title: 'Proyección de QR y PIN en Vivo',
        badge: 'Paso 2 de 3 • Auto-Check-in Alumnos',
        icon: Sparkles,
        accentGradient: 'from-sky-900 to-indigo-950',
        description: 'Abre el modal interactivo de Código QR para proyectarlo en pantalla completa en la sala. Los alumnos pueden escanearlo o ingresar el PIN de 4 dígitos.',
        tips: [
          'El registro de los estudiantes que escanean se refleja inmediatamente en tiempo real.',
          'Incluye botón para copiar el enlace de asistencia rápida.'
        ]
      },
      {
        id: 'attendance-roster',
        targetSelector: '#docente-attendance-table',
        title: 'Nómina y Registro Manual de Asistencia',
        badge: 'Paso 3 de 3 • Control de Alumnos',
        icon: CheckSquare,
        accentGradient: 'from-emerald-950 via-[#092c4c] to-teal-900',
        description: 'Supervisa a los inscritos, marca presentes o ausentes de forma manual con un solo clic, y añade alumnos que asistan presencialmente.',
        tips: [
          'Marcar "Ausente" notifica al alumno por correo sobre su inasistencia.',
          'Marcar "Presente" habilita automáticamente la encuesta de satisfacción para el alumno.'
        ]
      }
    ],
    flex_schedule: [
      {
        id: 'flex-banner',
        targetSelector: '#docente-flex-banner',
        title: 'Gestión de Horarios Flexibles',
        badge: 'Paso 1 de 2 • Solicitudes Estudiantiles',
        icon: Inbox,
        accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
        description: 'Revisa las peticiones de estudiantes que requieren tutoría pero cuyos horarios de clase no coincidían con la oferta semanal estándar.',
        tips: [
          'Los estudiantes indican sus materias críticas y bloques horarios libres.',
          'El contador superior te muestra cuántas solicitudes esperan respuesta.'
        ]
      },
      {
        id: 'flex-list',
        targetSelector: '#docente-flex-requests-list',
        title: 'Emparejamiento y Creación en 1 Clic',
        badge: 'Paso 2 de 2 • Asignación a Tutores',
        icon: CheckCircle2,
        accentGradient: 'from-sky-900 via-[#092c4c] to-indigo-950',
        description: 'Haz clic en "Resolver Solicitud" para asignar directamente un tutor con disponibilidad compatible y convertir la petición en una sesión oficial.',
        tips: [
          'El sistema prioriza automáticamente a los tutores con horarios libres coincidentes.',
          'Al resolver la solicitud, el estudiante recibe una confirmación automática por correo.'
        ]
      }
    ],
    tutors: [
      {
        id: 'tutors-register',
        targetSelector: '#docente-tutors-register-card',
        title: 'Registrar o Promover Tutores',
        badge: 'Paso 1 de 3 • Registro y Roles',
        icon: PlusCircle,
        accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
        description: 'Ingresa nuevos tutores o asigna el rol de tutor a estudiantes existentes mediante su RUT institucional, seleccionando si será Tutor Par o Tutor de Tutores.',
        tips: [
          'Tutor Par: Dicta sesiones directas y registra temarios.',
          'Tutor de Tutores: Rol de liderazgo con equipo de tutores a cargo y supervisión.'
        ]
      },
      {
        id: 'tutors-lead-assignment',
        targetSelector: '#docente-tutors-lead-assignment',
        title: 'Asignar Tutores a Cargo',
        badge: 'Paso 2 de 3 • Coordinación de Liderazgo',
        icon: ShieldCheck,
        accentGradient: 'from-indigo-950 via-[#092c4c] to-sky-900',
        description: 'Coordina y asocia qué tutores pares están bajo la supervisión y acompañamiento de cada Tutor de Tutores.',
        tips: [
          'Selecciona al Tutor de Tutores y marca las casillas de los tutores asignados.',
          'Permite delegar la revisión de cumplimiento y asistencia.'
        ]
      },
      {
        id: 'tutors-directory',
        targetSelector: '#docente-tutors-directory',
        title: 'Directorio y Nómina General de Tutores',
        badge: 'Paso 3 de 3 • Nómina Completa',
        icon: Users,
        accentGradient: 'from-[#092c4c] via-[#153a5c] to-slate-900',
        description: 'Consulta la lista completa de tutores habilitados, filtra por nombre o carrera, y edita sus credenciales o perfiles multi-rol.',
        tips: [
          'Usa el buscador para filtrar rápidamente tutores por nombre o carrera.',
          'Puedes modificar las contraseñas o promover roles en cualquier momento.'
        ]
      }
    ],
    students: [
      {
        id: 'students-header',
        targetSelector: '#docente-students-header',
        title: 'Directorio y Registro de Alumnos UFT',
        badge: 'Paso 1 de 2 • Comunidad Estudiantil',
        icon: Users,
        accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
        description: 'Monitorea y gestiona la base de estudiantes inscritos en los programas de acompañamiento y tutorías.',
        tips: [
          'Visualiza el total de estudiantes activos por carrera.',
          'Accede a la información de contacto institucional de cada alumno.'
        ]
      },
      {
        id: 'students-directory',
        targetSelector: '#docente-students-directory',
        title: 'Búsqueda, Edición y Registro Rápido',
        badge: 'Paso 2 de 2 • Administración',
        icon: Sparkles,
        accentGradient: 'from-sky-900 via-[#092c4c] to-indigo-950',
        description: 'Busca alumnos por RUT o nombre, edita sus datos académicos o registra nuevos ingresos de forma sencilla.',
        tips: [
          'Los estudiantes pueden iniciar sesión con su RUT institucional.',
          'Puedes verificar a qué carreras pertenecen y actualizar sus correos.'
        ]
      }
    ],
    alerts: [
      {
        id: 'alerts-header',
        targetSelector: '#docente-alerts-header',
        title: 'Avisos de Inconvenientes de Tutores',
        badge: 'Paso 1 de 2 • Alertas en Vivo',
        icon: AlertTriangle,
        accentGradient: 'from-rose-950 via-[#092c4c] to-slate-900',
        description: 'Revisa de inmediato las alertas enviadas por tutores que no pueden asistir a su clase por razones de fuerza mayor o topes horarios.',
        tips: [
          'El contador superior te indica los casos críticos pendientes de resolución.',
          'Cada alerta detalla el motivo del inconveniente y la sesión afectada.'
        ]
      },
      {
        id: 'alerts-list',
        targetSelector: '#docente-alerts-list',
        title: 'Reasignación Inmediata de Sustitutos',
        badge: 'Paso 2 de 2 • Resolución en 1 Clic',
        icon: CheckCircle2,
        accentGradient: 'from-[#092c4c] via-[#153a5c] to-emerald-950',
        description: 'Selecciona un tutor sustituto con disponibilidad libre y reasigna la sesión con un clic para que ningún alumno pierda su clase.',
        tips: [
          'Al resolver la reasignación, el nuevo tutor y los alumnos reciben un aviso automático.',
          'El historial de resolución queda registrado en las métricas de cumplimiento.'
        ]
      }
    ],
    announcements: [
      {
        id: 'announcements-header',
        targetSelector: '#docente-announcements-header',
        title: 'Emisión de Comunicados Oficiales UFT',
        badge: 'Paso 1 de 2 • Difusión Masiva',
        icon: Send,
        accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
        description: 'Canal oficial de coordinación para despachar avisos institucionales directamente al correo y a la bandeja web de los usuarios.',
        tips: [
          'Los comunicados se entregan en tiempo real vía WebSockets y notificaciones por correo.',
          'Llegan a la campana de notificaciones del portal de cada destinatario.'
        ]
      },
      {
        id: 'announcements-form',
        targetSelector: '#docente-announcements-form',
        title: 'Segmentación de Audiencia y Prioridad',
        badge: 'Paso 2 de 2 • Redacción y Envío',
        icon: Sparkles,
        accentGradient: 'from-sky-900 via-[#092c4c] to-indigo-950',
        description: 'Elige si el mensaje es para toda la comunidad, todos los estudiantes, tutores pares o los inscritos en una tutoría específica.',
        tips: [
          'Define la prioridad del mensaje (Normal, Alta o Urgente).',
          'Los comunicados urgentes destacan con aviso visual en el portal del estudiante.'
        ]
      }
    ],
    analytics: [
      {
        id: 'analytics-filters',
        targetSelector: '#docente-analytics-filters',
        title: 'Filtro Temporal y Exportación a Excel',
        badge: 'Paso 1 de 2 • Período y Reportes',
        icon: FileSpreadsheet,
        accentGradient: 'from-emerald-950 via-[#092c4c] to-teal-900',
        description: 'Segmenta las estadísticas por día, semana, mes, semestre o año, y descarga planillas Excel completas con formato institucional listo para auditorías.',
        tips: [
          'Selecciona el período de tiempo deseado con los botones de rango.',
          'Elige el tipo de informe y haz clic en "Descargar Excel" para obtener el archivo .xlsx.'
        ]
      },
      {
        id: 'analytics-kpis',
        targetSelector: '#docente-analytics-kpis',
        title: 'Tarjetas KPI e Indicadores Clave',
        badge: 'Paso 2 de 2 • Rendimiento Institucional',
        icon: TrendingUp,
        accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
        description: 'Monitorea en tiempo real los indicadores estratégicos de sesiones totales, asistencias efectivas, inasistencias, alumnos únicos y nivel de satisfacción.',
        tips: [
          'Supervisa la tasa de asistencia efectiva para medir la participación de los alumnos.',
          'Consulta el promedio de satisfacción general evaluado por los estudiantes.'
        ]
      }
    ],
    comments: [
      {
        id: 'comments-header',
        targetSelector: '#docente-comments-header',
        title: 'Retroalimentación y Encuestas de Alumnos',
        badge: 'Paso 1 de 2 • Calidad Docente',
        icon: MessageSquare,
        accentGradient: 'from-[#092c4c] via-[#103a63] to-sky-900',
        description: 'Revisa las evaluaciones, calificaciones en estrellas y opiniones dejadas por los alumnos tras asistir a cada tutoría o taller.',
        tips: [
          'Permite supervisar la percepción pedagógica y calidad del acompañamiento.',
          'Los estudiantes evalúan dominio del tema, claridad y utilidad.'
        ]
      },
      {
        id: 'comments-filters',
        targetSelector: '#docente-comments-filters',
        title: 'Filtros por Calificación y Encuesta Detallada',
        badge: 'Paso 2 de 2 • Búsqueda y Detalle',
        icon: Sparkles,
        accentGradient: 'from-amber-950 via-[#092c4c] to-sky-900',
        description: 'Filtra por calificación de 1 a 5 estrellas, busca comentarios específicos o abre la encuesta completa para ver las respuestas desglosadas.',
        tips: [
          'Haz clic en "Ver Encuesta Detallada" para ver la rúbrica completa de preguntas.',
          'Usa el buscador para revisar comentarios sobre un tutor específico.'
        ]
      }
    ]
  }), []);

  const steps: StepItem[] = useMemo(() => {
    return stepsByTab[activeTab] || stepsByTab.calendar;
  }, [stepsByTab, activeTab]);

  // Foco sobre el elemento del paso: se mueve una sola vez, sincronizado con el scroll
  const { targetRect, animate, viewport: windowDimensions } = useTutorialSpotlight({
    isOpen,
    stepKey: `${activeTab}:${currentStep}`,
    resolveTarget: () => {
      const stepObj = steps[currentStep];
      return stepObj ? (document.querySelector(stepObj.targetSelector) as HTMLElement | null) : null;
    },
    resolveFallback: () => document.querySelector('main') as HTMLElement | null,
  });
  const isMobile = windowDimensions.width < 768;

  // Volver al primer paso al abrir el tutorial o cambiar de apartado
  useEffect(() => {
    if (isOpen) {
      if (!wasOpenRef.current) {
        wasOpenRef.current = true;
      }
      setCurrentStep(0);
    } else {
      wasOpenRef.current = false;
    }
  }, [isOpen, activeTab]);

  // Manejador de teclado para siguiente, anterior y escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (currentStep < steps.length - 1) {
          setCurrentStep(prev => prev + 1);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStep > 0) {
          setCurrentStep(prev => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, steps.length, onClose]);

  if (!isOpen) return null;

  const currentStepData = steps[currentStep] || steps[0];
  const StepIcon = currentStepData.icon || Sparkles;
  const isLastStep = currentStep === steps.length - 1;

  // Cálculo de posicionamiento del popover con prioridad inferior y contención estricta
  const popoverWidth = isMobile ? Math.min(windowDimensions.width - 24, 380) : 420;
  const popoverEstimatedHeight = isMobile ? 320 : 340;
  const padding = 14;

  let popoverStyle: React.CSSProperties = {
    position: 'fixed',
    width: `${popoverWidth}px`,
    zIndex: 9999,
  };

  if (targetRect) {
    const spaceBelow = windowDimensions.height - targetRect.bottom;
    const spaceAbove = targetRect.top;

    let preferBelow = true;
    if (spaceBelow < popoverEstimatedHeight + 20 && spaceAbove > spaceBelow) {
      preferBelow = false;
    }

    let top = 0;
    if (preferBelow) {
      top = targetRect.bottom + padding;
    } else {
      top = targetRect.top - popoverEstimatedHeight - padding;
    }

    // Asegurar que el popover esté SIEMPRE 100% visible en pantalla
    top = Math.max(12, Math.min(windowDimensions.height - popoverEstimatedHeight - 12, top));

    let left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
    left = Math.max(12, Math.min(windowDimensions.width - popoverWidth - 12, left));

    popoverStyle.top = 0;
    popoverStyle.left = 0;
    popoverStyle.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    popoverStyle.transition = getSpotlightTransition(animate, ['transform']);
  } else {
    popoverStyle.top = '50%';
    popoverStyle.left = '50%';
    popoverStyle.transform = 'translate(-50%, -50%)';
  }

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[9990] select-none pointer-events-auto" onClick={onClose}>
      {/* Fondo oscuro con foco recortado sobre el elemento del paso */}
      {targetRect ? (
        <TutorialSpotlight
          rect={targetRect}
          animate={animate}
          stepNumber={currentStep + 1}
          viewportWidth={windowDimensions.width}
          accent="sky"
          zIndex={9991}
          padding={6}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/80" style={{ zIndex: 9991 }} />
      )}

      {/* Floating Tutorial Popover Card */}
      <div
        ref={popoverRef}
        style={popoverStyle}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden will-change-transform"
      >
        {/* Header con Gradiente UFT */}
        <div className={`bg-gradient-to-r ${currentStepData.accentGradient} p-4 text-white relative`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/15 text-sky-300 border border-white/20 shrink-0">
                <StepIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-white">
                  {currentStepData.badge}
                </span>
                <h3 className="text-sm font-extrabold leading-snug text-white mt-1">
                  {currentStepData.title}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
              title="Cerrar tutorial (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cuerpo del Popover */}
        <div key={`${activeTab}:${currentStep}`} className="p-4 space-y-3.5 text-xs text-slate-600 dark:text-slate-300 animate-step-in">
          <p className="leading-relaxed font-medium text-slate-800 dark:text-slate-200">
            {currentStepData.description}
          </p>

          {currentStepData.tips && currentStepData.tips.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/70 dark:border-slate-700/50 space-y-1.5">
              <div className="font-bold text-[11px] text-[#092c4c] dark:text-sky-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Puntos clave a recordar:</span>
              </div>
              <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                {currentStepData.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#3a9ad9] font-black">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Barra de Progreso de Pasos */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <div className="flex items-center gap-1">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStep 
                      ? 'w-6 bg-[#3a9ad9]' 
                      : idx < currentStep 
                        ? 'w-2 bg-slate-400 dark:bg-slate-600' 
                        : 'w-2 bg-slate-200 dark:bg-slate-700'
                  }`}
                  title={`Ir al paso ${idx + 1}`}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
              Paso {currentStep + 1} de {steps.length}
            </span>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Saltar
            </button>

            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#092c4c] to-[#153a5c] hover:from-[#0d3b66] hover:to-[#1e4a73] text-white text-xs font-extrabold shadow-md shadow-slate-900/10 hover:shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isLastStep ? '¡Entendido!' : 'Siguiente'}</span>
                {!isLastStep && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
