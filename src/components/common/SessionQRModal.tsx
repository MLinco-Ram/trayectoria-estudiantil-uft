import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Session, User } from '../../types';
import { X, QrCode, Calendar, Clock, MapPin, Sparkles, CheckCircle2, Maximize2, Minimize2, Tv } from 'lucide-react';

interface SessionQRModalProps {
  session: Session | null;
  onClose: () => void;
  allUsers?: User[];
}

export const SessionQRModal: React.FC<SessionQRModalProps> = ({ session, onClose, allUsers = [] }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pantalla completa real del navegador (Fullscreen API), no solo agrandar el modal.
  // El estado se sincroniza con el navegador: salir con Esc también lo actualiza.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current && !!containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen();
      else setIsFullscreen(v => !v); // navegadores sin la API (iPhone): se agranda dentro de la página
    } catch {
      setIsFullscreen(v => !v);
    }
  };

  const handleClose = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setIsFullscreen(false);
    onClose();
  };

  if (!session) return null;

  const tutor = allUsers.find(u => u.id === session.tutorId);
  const docente = allUsers.find(u => u.id === session.docenteId);

  // Solo el id de la sesión, sin logo y con corrección de errores M: el QR queda con 25 módulos por lado
  // (antes un JSON con título, fecha y hora, nivel H y logo: 69 módulos). Cada cuadrito es ~3 veces más
  // grande, así se lee desde el fondo de la sala. El escáner del alumno acepta el id directo.
  const qrPayload = session.id;

  // Pantalla completa: solo el QR, lo más grande posible sobre fondo blanco, y la X para salir
  if (isFullscreen) {
    return (
      <div ref={containerRef} className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <QRCodeSVG value={qrPayload} level="M" marginSize={2} style={{ width: 'min(96vh, 96vw)', height: 'min(96vh, 96vw)' }} />
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-3 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className={`bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-300 ${
        isFullscreen 
          ? 'w-screen h-screen rounded-none max-w-none' 
          : 'w-full max-w-2xl max-h-[92vh]'
      }`}>
        
        {/* Modal Header */}
        <div className="bg-[#092c4c] px-6 py-5 sm:px-8 sm:py-6 text-white relative shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-[#3a9ad9] text-xs sm:text-sm font-extrabold uppercase tracking-widest">
              <Tv className="w-5 h-5 text-[#3a9ad9]" />
              <span>Modo Proyección • Asistencia UFT</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title={isFullscreen ? 'Salir de pantalla completa' : 'Expandir a pantalla completa para proyector'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{isFullscreen ? 'Normal' : 'Pantalla Completa'}</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <h3 className={`font-extrabold tracking-tight text-white mt-3 ${isFullscreen ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
            {session.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#3a9ad9] shrink-0" />
            <span>{session.location}</span>
            <span className="text-slate-500">•</span>
            <span>{tutor ? `Tutor: ${tutor.name}` : docente ? `Docente: ${docente.name}` : 'Coordinación UFT'}</span>
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto flex flex-col items-center justify-center text-center space-y-6">
          
          {/* Info pill with large high contrast font */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm sm:text-base font-extrabold text-slate-700 bg-slate-100 px-6 py-2.5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="flex items-center gap-1.5 text-[#092c4c]">
              <Calendar className="w-4 h-4 text-[#3a9ad9]" />
              {session.date}
            </span>
            <span className="text-slate-400 font-normal">|</span>
            <span className="flex items-center gap-1.5 text-[#092c4c]">
              <Clock className="w-4 h-4 text-[#3a9ad9]" />
              {session.timeSlot}
            </span>
          </div>

          {/* Massive QR Code Container optimized for projection distance */}
          {/* Ocupa todo el alto disponible: en pantalla completa casi toda la pantalla del proyector */}
          <div className="bg-white p-3 rounded-2xl border-2 border-slate-200 shadow-xl flex items-center justify-center">
            <QRCodeSVG
              value={qrPayload}
              level="M"
              marginSize={2}
              style={{
                width: isFullscreen ? 'min(78vh, 92vw)' : 'min(58vh, 80vw)',
                height: isFullscreen ? 'min(78vh, 92vw)' : 'min(58vh, 80vw)',
              }}
            />
          </div>

          {/* Student scan notice */}
          <div className="max-w-xl w-full bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 text-center space-y-1 shadow-sm">
            <p className="text-xs sm:text-sm font-extrabold text-[#092c4c] flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#3a9ad9]" />
              Abre la app en tu celular y pulsa el botón "Escanear QR" abajo
            </p>
            <p className="text-[11px] sm:text-xs text-sky-800 font-medium">
              La asistencia se marcará al instante y en tiempo real en la lista del docente/tutor.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] sm:text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Sincronización en vivo activa
          </span>
          <button
            onClick={handleClose}
            className="py-2.5 px-6 rounded-xl bg-[#092c4c] hover:bg-[#153a5c] text-white text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer"
          >
            Cerrar Proyector QR
          </button>
        </div>
      </div>
    </div>
  );
};
