import React from 'react';
import { ShieldCheck, BookOpen, Lock, CheckCircle, X, FileText } from 'lucide-react';

interface TermsAndConditionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

export default function TermsAndConditionsModal({
  isOpen,
  onClose,
  onAccept
}: TermsAndConditionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-brand-navy p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <FileText className="w-5 h-5 text-brand-celeste" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">Términos, Condiciones y Privacidad</h2>
              <p className="text-[11px] text-brand-celeste">Centro de Apoyo al Aprendizaje • UFT</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-700 text-xs leading-relaxed">
          <p className="font-medium text-slate-800">
            Bienvenido a la plataforma <strong>Trayectoria Estudiantil UFT</strong>. Al registrarte y utilizar este portal institucional, aceptas las siguientes cláusulas y políticas de tratamiento de información:
          </p>

          {/* Card 1: Protección de Datos Personales */}
          <div className="p-3.5 bg-sky-50/80 rounded-xl border border-sky-100 flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4 text-sky-700" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sky-950 text-xs">1. Protección y Seguridad de Datos Personales</h3>
              <p className="text-[11px] text-sky-900 leading-normal">
                Tus datos identificatorios (Nombre completo, RUT chileno, correo institucional @uft.cl / @mail.uft.cl / @uft.edu y carrera) están estrictamente resguardados mediante mecanismos de seguridad y cifrado, garantizando que tu información personal no sea compartida ni transferida a terceros ajenos a la universidad.
              </p>
            </div>
          </div>

          {/* Card 2: Fines Académicos y Seguimiento */}
          <div className="p-3.5 bg-indigo-50/80 rounded-xl border border-indigo-100 flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4 text-indigo-700" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-indigo-950 text-xs">2. Uso Exclusivo para Fines Académicos y Acompañamiento</h3>
              <p className="text-[11px] text-indigo-900 leading-normal">
                Las estadísticas generadas en la plataforma (registro de asistencia a tutorías, participación en talleres psicoeducativos, solicitudes de horarios flexibles y retroalimentación académica) serán utilizadas <strong>única y exclusivamente con fines pedagógicos</strong>, de apoyo al rendimiento y acompañamiento de tu trayectoria universitaria.
              </p>
            </div>
          </div>

          {/* Card 3: Compromiso del Estudiante */}
          <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-100 flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-emerald-950 text-xs">3. Compromiso y Responsabilidad Académica</h3>
              <p className="text-[11px] text-emerald-900 leading-normal">
                El estudiante se compromete a hacer un uso ético y responsable de los cupos de tutorías, avisando oportunamente en caso de incompatibilidad horaria para optimizar la asignación de recursos y tutores pares.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          {onAccept && (
            <button
              type="button"
              onClick={() => {
                onAccept();
                onClose();
              }}
              className="py-2 px-4 rounded-xl bg-brand-navy hover:bg-[#07203b] text-white font-bold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Aceptar y Continuar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
