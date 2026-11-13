import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { User, Session } from '../../types';
import { sessionsApi } from '../../services/api';
import { X, QrCode, Camera, CheckCircle2, AlertTriangle, RefreshCw, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';

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
  const [successInfo, setSuccessInfo] = useState<{ title: string; timeSlot: string; alreadyPresent?: boolean; message?: string } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStartedRef = useRef(false);
  // La cámara entrega varios cuadros por segundo con el mismo QR: solo se procesa la primera lectura
  // (con estado de React el valor llegaba desactualizado y se enviaban varias, de ahí el "ya estabas presente")
  const processingRef = useRef(false);
  // Zoom óptico/digital de la cámara (no de la página), si el dispositivo lo permite
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const applyZoom = async (value: number) => {
    if (!zoomRange || !html5QrCodeRef.current) return;
    const next = Math.min(zoomRange.max, Math.max(zoomRange.min, value));
    setZoom(next);
    try {
      await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ zoom: next } as MediaTrackConstraintSet] } as MediaTrackConstraints);
    } catch (err) {
      console.warn('No se pudo aplicar el zoom:', err);
    }
  };

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

      // Solo QR y, si el navegador lo trae (Chrome/Android), el detector nativo, mucho más rápido
      const html5QrCode = new Html5Qrcode('uft-qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });
      html5QrCodeRef.current = html5QrCode;

      // Sin recuadro (qrbox): se analiza el cuadro completo, así un QR lejano y pequeño también se lee.
      // Se pide resolución alta y enfoque continuo para distinguir los módulos a distancia.
      const config = {
        fps: 15,
        aspectRatio: 1.0,
        videoConstraints: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
        } as MediaTrackConstraints,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Frame error (no QR detected in frame) - ignore
        }
      );

      isStartedRef.current = true;
      setIsScanning(true);

      try {
        const caps = html5QrCode.getRunningTrackCapabilities() as MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } };
        if (caps.zoom && caps.zoom.max > caps.zoom.min) {
          setZoomRange({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 });
          setZoom(caps.zoom.min);
        } else {
          setZoomRange(null);
        }
      } catch {
        setZoomRange(null);
      }
    } catch (err: any) {
      console.warn('Error al iniciar cámara:', err);
      setIsScanning(false);
      setErrorMessage(
        'No se pudo acceder a la cámara. Por favor permite los permisos o ingresa el código manualmente.'
      );
    }
  };

  const stopScanner = async () => {
    try {
      if (html5QrCodeRef.current && isStartedRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
        isStartedRef.current = false;
        setIsScanning(false);
        setZoomRange(null);
      }
    } catch (err) {
      console.warn('Error al detener escáner:', err);
    }
  };

  const handleSuccessfulScan = async (rawDecodedText: string, viaPin = false) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Vibrate if supported
      if ('vibrate' in navigator) {
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

      const response = viaPin
        ? await sessionsApi.registerPinAttendance(sessionId)
        : await sessionsApi.registerQRAttendance(sessionId, currentUser.id);

      if (response && response.success) {
        await stopScanner();
        setSuccessInfo({
          title: response.session?.title || sessionTitle || 'Tutoría UFT',
          timeSlot: response.session?.timeSlot || sessionTime || 'Horario Registrado',
          alreadyPresent: response.alreadyPresent,
          message: response.message,
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
      // Pausa breve antes de aceptar otra lectura, para no reenviar el mismo QR tras un error
      setTimeout(() => { processingRef.current = false; }, 1500);
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    // 6 dígitos = PIN mostrado junto al QR; cualquier otra cosa se trata como id de sesión o texto del QR
    const digits = code.replace(/[\s-]/g, '');
    if (/^\d{6}$/.test(digits)) handleSuccessfulScan(digits, true);
    else handleSuccessfulScan(code);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
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
              <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${
                successInfo.alreadyPresent 
                  ? 'bg-sky-100 text-[#092c4c]' 
                  : 'bg-emerald-100 text-emerald-600'
              }`}>
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <span className={`text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full ${
                  successInfo.alreadyPresent
                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}>
                  {successInfo.alreadyPresent ? 'ℹ Ya Estabas Presente' : '✓ ¡Asistencia Registrada!'}
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-2">{successInfo.title}</h4>
                <p className="text-xs text-slate-500 font-semibold">{successInfo.timeSlot}</p>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  {successInfo.message || (successInfo.alreadyPresent ? 'Ya te encontrabas registrado como presente en esta tutoría.' : 'Tu asistencia ha sido validada y confirmada.')}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Estudiante: <strong className="text-slate-700">{currentUser.name}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
                className={`w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold transition-all shadow-md mt-4 cursor-pointer ${
                  successInfo.alreadyPresent
                    ? 'bg-[#092c4c] hover:bg-[#153a5c]'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
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

              {zoomRange && (
                <div className="flex items-center gap-2 px-1">
                  <button type="button" onClick={() => applyZoom(zoom - Math.max(zoomRange.step, 0.5))} className="p-2 rounded-lg bg-slate-100 text-[#092c4c] cursor-pointer" aria-label="Alejar">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <input
                    type="range"
                    min={zoomRange.min}
                    max={zoomRange.max}
                    step={zoomRange.step}
                    value={zoom}
                    onChange={(e) => applyZoom(Number(e.target.value))}
                    className="flex-1 accent-[#3a9ad9]"
                    aria-label="Zoom de la cámara"
                  />
                  <button type="button" onClick={() => applyZoom(zoom + Math.max(zoomRange.step, 0.5))} className="p-2 rounded-lg bg-slate-100 text-[#092c4c] cursor-pointer" aria-label="Acercar">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-500 w-10 text-right">{zoom.toFixed(1)}x</span>
                </div>
              )}

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
                    ¿No puedes escanear? Ingresa el PIN que aparece junto al QR:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Ej: 123 456"
                      className="flex-1 min-w-0 text-base tracking-widest font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3a9ad9]"
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
