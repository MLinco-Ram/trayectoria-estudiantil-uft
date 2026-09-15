import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { User, Session } from '../../types';
import { sessionsApi } from '../../services/api';
import { X, QrCode, Camera, CheckCircle2, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';

interface MobileQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onAttendanceRegistered?: (session: Session) => void;
}

export const MobileQRScannerModal: React.FC<MobileQRScannerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAttendanceRegistered,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ title: string; timeSlot: string } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStartedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setErrorMessage(null);
      setSuccessInfo(null);
      return;
    }

    const timer = setTimeout(() => {
      startScanner();
    }, 300);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setErrorMessage(null);
      const element = document.getElementById('uft-qr-reader');
      if (!element) return;

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('uft-qr-reader');
      }

      const qrCode = html5QrCodeRef.current;
      if (isStartedRef.current) {
        return;
      }

      setIsScanning(true);

      const qrConfig = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await qrCode.start(
        { facingMode: 'environment' },
        qrConfig,
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Frame error callback - ignore standard scan frame misses
        }
      );

      isStartedRef.current = true;
    } catch (err: any) {
      console.warn('Error starting camera scanner:', err);
      setIsScanning(false);
      isStartedRef.current = false;
      setErrorMessage('No se pudo acceder a la cámara. Revisa los permisos o ingresa el código manualmente.');
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && isStartedRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      } finally {
        isStartedRef.current = false;
        setIsScanning(false);
      }
    }
  };

  const handleSuccessfulScan = async (rawDecodedText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      let sessionId = rawDecodedText.trim();
      let sessionTitle = '';
      let sessionTime = '';

      try {
        const parsed = JSON.parse(rawDecodedText);
        if (parsed && parsed.sessionId) {
          sessionId = parsed.sessionId;
          sessionTitle = parsed.title || '';
          sessionTime = parsed.timeSlot || '';
        }
      } catch {
        // Raw sessionId string fallback
      }

      const response = await sessionsApi.registerQRAttendance(sessionId, currentUser.id);

      if (response && response.success) {
        await stopScanner();
        setSuccessInfo({
          title: response.session?.title || sessionTitle || 'Tutoría UFT',
          timeSlot: response.session?.timeSlot || sessionTime || 'Horario Registrado',
        });
        if (onAttendanceRegistered && response.session) {
          onAttendanceRegistered(response.session);
        }
      } else {
        setErrorMessage('No se pudo validar la sesión o ya está cerrada.');
      }
    } catch (err: any) {
      console.error('Error al registrar asistencia QR:', err);
      setErrorMessage(err.message || 'Error al validar el código QR de la sesión.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleSuccessfulScan(manualCode.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#092c4c] p-5 text-white relative shrink-0">
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Cerrar escáner"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-[#3a9ad9] text-[11px] font-extrabold uppercase tracking-widest mb-1">
            <Camera className="w-4 h-4" />
            <span>Escáner de Asistencia UFT</span>
          </div>
          <h3 className="text-lg font-bold tracking-tight text-white">Escanear Código QR</h3>
          <p className="text-xs text-slate-300">
            Apunta al código QR proyectado por tu docente o tutor.
          </p>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {successInfo ? (
            <div className="py-6 flex flex-col items-center text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-lg">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
                  ¡Asistencia Registrada!
                </span>
                <h4 className="text-base font-bold text-slate-900">{successInfo.title}</h4>
                <p className="text-xs text-slate-500 font-semibold">{successInfo.timeSlot}</p>
                <p className="text-xs text-slate-400 mt-2">
                  Estudiante: <strong className="text-slate-700">{currentUser.name}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md mt-4 cursor-pointer"
              >
                Finalizar y Continuar
              </button>
            </div>
          ) : (
            <>
              {/* Scanner Video Area */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-[#3a9ad9] aspect-square flex items-center justify-center shadow-inner">
                <div id="uft-qr-reader" className="w-full h-full"></div>
                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white space-y-2 z-20">
                    <RefreshCw className="w-8 h-8 animate-spin text-[#3a9ad9]" />
                    <span className="text-xs font-bold">Validando asistencia...</span>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{errorMessage}</p>
                    <button
                      type="button"
                      onClick={() => startScanner()}
                      className="mt-1.5 text-xs text-red-800 font-bold underline cursor-pointer"
                    >
                      Reintentar cámara
                    </button>
                  </div>
                </div>
              )}

              {/* Manual code fallback */}
              <div className="pt-2 border-t border-slate-100">
                <form onSubmit={handleManualSubmit} className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-600">
                    ¿Problemas con la cámara? Ingresa el ID de la sesión:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Ej: sess-12345 o pega el texto QR"
                      className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3a9ad9]"
                    />
                    <button
                      type="submit"
                      disabled={!manualCode.trim() || isProcessing}
                      className="px-3 py-2 bg-[#092c4c] text-white rounded-xl text-xs font-bold hover:bg-[#153a5c] disabled:opacity-50 cursor-pointer"
                    >
                      Marcar
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
