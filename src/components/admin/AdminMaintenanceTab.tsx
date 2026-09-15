import React, { useState } from 'react';
import { 
  Trash2, 
  AlertTriangle, 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  Users, 
  Calendar, 
  Inbox, 
  Bell, 
  Clock, 
  FileText,
  Lock
} from 'lucide-react';
import { systemApi } from '../../services/api';

interface AdminMaintenanceTabProps {
  onSuccessReset?: () => void;
}

export const AdminMaintenanceTab: React.FC<AdminMaintenanceTabProps> = ({ onSuccessReset }) => {
  const [isResetting, setIsResetting] = useState(false);
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [result, setResult] = useState<{
    status: 'success' | 'error';
    message: string;
    deletedCounts?: Record<string, number | string>;
  } | null>(null);

  const [selectedItems, setSelectedItems] = useState({
    sessions: true,
    student_requests: true,
    reports: true,
    notifications: true,
    availabilities: true,
    broadcast_history: true
  });

  const toggleItem = (key: keyof typeof selectedItems) => {
    setSelectedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleResetData = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (confirmKeyword.trim().toUpperCase() !== 'VACIAR') {
      setResult({
        status: 'error',
        message: 'Debes escribir exactamente la palabra "VACIAR" para confirmar esta operación.'
      });
      return;
    }

    const selectedCollections = Object.entries(selectedItems)
      .filter(([_, isChecked]) => isChecked)
      .map(([colName]) => colName);

    if (selectedCollections.length === 0) {
      setResult({
        status: 'error',
        message: 'Debes seleccionar al menos una categoría de datos para vaciar.'
      });
      return;
    }

    const isConfirmed = window.confirm(
      '⚠️ ADVERTENCIA CRÍTICA:\n\n¿Estás completamente seguro de vaciar las tutorías y actividades seleccionadas en MongoDB Atlas?\n\n* Las cuentas de usuarios (Docentes, Tutores, Alumnos y Admin) NO serán eliminadas.\n* Toda la sincronización se actualizará en tiempo real vía WebSockets.'
    );

    if (!isConfirmed) return;

    setIsResetting(true);

    try {
      const res = await systemApi.resetAcademicData(selectedCollections);
      
      // Limpiar también caches locales del navegador
      if (selectedItems.sessions) localStorage.removeItem('uft_te_sessions');
      if (selectedItems.student_requests) localStorage.removeItem('uft_te_student_requests');
      if (selectedItems.reports) localStorage.removeItem('uft_te_reports');
      if (selectedItems.notifications) localStorage.removeItem('uft_te_notifications');
      if (selectedItems.availabilities) localStorage.removeItem('uft_te_availabilities');

      setResult({
        status: 'success',
        message: res.message || 'Datos académicos vaciados exitosamente.',
        deletedCounts: res.deletedCounts
      });

      setConfirmKeyword('');

      if (onSuccessReset) {
        onSuccessReset();
      }
    } catch (err: any) {
      setResult({
        status: 'error',
        message: err.message || 'Ocurrió un error al vaciar los datos en MongoDB Atlas.'
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Principal de Mantenimiento */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-[#092c4c] text-white p-6 md:p-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl text-rose-300 border border-white/15">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Limpieza y Vaciado de Datos Académicos
                <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Zona de Mantenimiento
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Permite dejar el sistema en blanco para un nuevo semestre o periodo lectivo, limpiando tutorías y solicitudes pero **preservando todas las cuentas de usuarios**.
              </p>
            </div>
          </div>
        </div>

        {/* Protección y Políticas */}
        <div className="p-6 md:p-8 space-y-6">
          {result && (
            <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 animate-fade-in ${
              result.status === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {result.status === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold text-sm">{result.message}</p>
                {result.deletedCounts && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    {Object.entries(result.deletedCounts).map(([col, count]) => (
                      <div key={col} className="bg-white/80 px-2.5 py-1.5 rounded-lg border border-emerald-200 font-mono">
                        <span className="text-slate-500">{col}:</span> <strong>{count} eliminados</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Garantía de Seguridad de Usuarios */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 space-y-1">
              <strong className="block font-bold">Protección Absoluta de Cuentas de Usuarios:</strong>
              <p className="text-emerald-800">
                Esta acción <strong>NO eliminará</strong> a los Docentes, Tutores Pares, Alumnos ni credenciales de Administrador. Todos los usuarios mantendrán su acceso, contraseñas y roles intactos en MongoDB Atlas.
              </p>
            </div>
          </div>

          <form onSubmit={handleResetData} className="space-y-6">
            {/* Selección de Colecciones a Vaciar */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Selecciona qué datos deseas vaciar de MongoDB Atlas:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Sesiones */}
                <label className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                  selectedItems.sessions ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedItems.sessions}
                    onChange={() => toggleItem('sessions')}
                    className="mt-1 h-4 w-4 rounded text-rose-600 accent-rose-600"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-rose-600" />
                      Tutorías y Talleres (Sessions)
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Elimina todas las sesiones programadas, cupos tomados e historiales de asistencia.
                    </p>
                  </div>
                </label>

                {/* 2. Solicitudes de Alumnos */}
                <label className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                  selectedItems.student_requests ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedItems.student_requests}
                    onChange={() => toggleItem('student_requests')}
                    className="mt-1 h-4 w-4 rounded text-rose-600 accent-rose-600"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                      <Inbox className="w-3.5 h-3.5 text-rose-600" />
                      Solicitudes de Horario Flexible
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Limpia la bandeja de solicitudes por topes y justificaciones de alumnos.
                    </p>
                  </div>
                </label>

                {/* 3. Reportes de Tutores */}
                <label className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                  selectedItems.reports ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedItems.reports}
                    onChange={() => toggleItem('reports')}
                    className="mt-1 h-4 w-4 rounded text-rose-600 accent-rose-600"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Alertas e Incidencias de Tutores
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Vacía tickets de reasignación y contratiempos reportados por tutores.
                    </p>
                  </div>
                </label>

                {/* 4. Notificaciones */}
                <label className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                  selectedItems.notifications ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedItems.notifications}
                    onChange={() => toggleItem('notifications')}
                    className="mt-1 h-4 w-4 rounded text-rose-600 accent-rose-600"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-rose-600" />
                      Bandejas de Notificaciones
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Elimina el historial de comprobantes y alertas enviadas a los correos en la app.
                    </p>
                  </div>
                </label>

                {/* 5. Disponibilidades Horarias */}
                <label className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                  selectedItems.availabilities ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedItems.availabilities}
                    onChange={() => toggleItem('availabilities')}
                    className="mt-1 h-4 w-4 rounded text-rose-600 accent-rose-600"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-600" />
                      Disponibilidad Semanal Cargada
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Resetea los bloques horarios cargados por tutores para que los definan de nuevo.
                    </p>
                  </div>
                </label>

                {/* 6. Comunicados Masivos */}
                <label className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                  selectedItems.broadcast_history ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedItems.broadcast_history}
                    onChange={() => toggleItem('broadcast_history')}
                    className="mt-1 h-4 w-4 rounded text-rose-600 accent-rose-600"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-rose-600" />
                      Historial de Comunicados Masivos
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Elimina registros de correos y avisos institucionales masivos pasados.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Confirmación con Palabra Clave */}
            <div className="bg-rose-50/50 p-5 rounded-2xl border border-rose-200 space-y-3">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                <Lock className="w-4 h-4 text-rose-600" />
                <span>Confirmación de Seguridad</span>
              </div>
              <p className="text-xs text-slate-600">
                Para evitar accidentes, escribe la palabra <strong className="text-rose-700 font-mono font-black">VACIAR</strong> en el siguiente campo para desbloquear el botón de reseteo:
              </p>

              <div className="max-w-xs">
                <input
                  type="text"
                  value={confirmKeyword}
                  onChange={(e) => setConfirmKeyword(e.target.value)}
                  placeholder='Escribe "VACIAR" aquí'
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 bg-white text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none uppercase"
                />
              </div>
            </div>

            {/* Botón de Ejecución */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-slate-400" />
                <span>Impacto directo en la base de datos <strong>MongoDB Atlas</strong></span>
              </div>

              <button
                type="submit"
                disabled={isResetting || confirmKeyword.trim().toUpperCase() !== 'VACIAR'}
                className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'Vaciando base de datos...' : 'Ejecutar Vaciado de Tutorías'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
