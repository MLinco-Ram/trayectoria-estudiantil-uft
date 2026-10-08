import React from 'react';
import { 
  Mail, 
  Send, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Server, 
  Key, 
  AtSign, 
  ExternalLink,
  Sliders,
  Database
} from 'lucide-react';

interface AdminSmtpTabProps {
  smtpHost: string;
  setSmtpHost: (v: string) => void;
  smtpPort: number;
  setSmtpPort: (v: number) => void;
  smtpSecure: boolean;
  setSmtpSecure: (v: boolean) => void;
  smtpUser: string;
  setSmtpUser: (v: string) => void;
  smtpPass: string;
  setSmtpPass: (v: string) => void;
  smtpFromName: string;
  setSmtpFromName: (v: string) => void;
  hasStoredPassword: boolean;
  isConfigured: boolean;
  isLoadingSmtp: boolean;
  saveStatus: { status: 'success' | 'error'; message: string } | null;
  handleSaveSmtp: (e: React.FormEvent) => void;
  testRecipient: string;
  setTestRecipient: (v: string) => void;
  isTesting: boolean;
  testResult: { status: 'success' | 'error'; message: string } | null;
  handleTestEmail: (e: React.FormEvent) => void;
  testTutorRecipient: string;
  setTestTutorRecipient: (v: string) => void;
  isTestingTutor: boolean;
  tutorTestResult: { status: 'success' | 'error'; message: string } | null;
  handleTestTutorReminder: (e: React.FormEvent) => void;
  testInconvenienceRecipient: string;
  setTestInconvenienceRecipient: (v: string) => void;
  isTestingInconvenience: boolean;
  inconvenienceTestResult: { status: 'success' | 'error'; message: string } | null;
  handleTestInconvenienceAlert: (e: React.FormEvent) => void;
}

export const AdminSmtpTab: React.FC<AdminSmtpTabProps> = ({
  smtpHost,
  setSmtpHost,
  smtpPort,
  setSmtpPort,
  smtpSecure,
  setSmtpSecure,
  smtpUser,
  setSmtpUser,
  smtpPass,
  setSmtpPass,
  smtpFromName,
  setSmtpFromName,
  hasStoredPassword,
  isConfigured,
  isLoadingSmtp,
  saveStatus,
  handleSaveSmtp,
  testRecipient,
  setTestRecipient,
  isTesting,
  testResult,
  handleTestEmail,
  testTutorRecipient,
  setTestTutorRecipient,
  isTestingTutor,
  tutorTestResult,
  handleTestTutorReminder,
  testInconvenienceRecipient,
  setTestInconvenienceRecipient,
  isTestingInconvenience,
  inconvenienceTestResult,
  handleTestInconvenienceAlert,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Columna Izquierda: Formulario de Configuración */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-[#3a9ad9]" />
                Parámetros del Servidor SMTP
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                La configuración se almacena en la colección <span className="font-mono text-[#3a9ad9]">settings</span> de MongoDB Atlas.
              </p>
            </div>
            {isConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Configurado en Mongo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                Pendiente de Clave
              </span>
            )}
          </div>

          <form onSubmit={handleSaveSmtp} className="mt-6 space-y-5">
            {saveStatus && (
              <div className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
                saveStatus.status === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {saveStatus.status === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                <span>{saveStatus.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  Servidor Host SMTP
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Puerto del Servidor
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value, 10))}
                    className="w-28 px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono"
                    required
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="rounded border-slate-300 text-[#3a9ad9] focus:ring-[#3a9ad9]"
                    />
                    <span>Conexión SSL/TLS (Puerto 465)</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-slate-400" />
                Correo Electrónico (Usuario SMTP)
              </label>
              <input
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="ejemplo@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  Contraseña de Aplicación de Google (16 caracteres)
                </span>
                {hasStoredPassword && (
                  <span className="text-emerald-600 text-xs font-bold flex items-center gap-1">
                    ✓ Guardada en Mongo
                  </span>
                )}
              </label>
              <input
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder={hasStoredPassword ? "•••••••••••••••• (Escribe sólo si deseas cambiarla)" : "xxxx xxxx xxxx xxxx"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono placeholder:font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nombre de Remitente Visible
              </label>
              <input
                type="text"
                value={smtpFromName}
                onChange={(e) => setSmtpFromName(e.target.value)}
                placeholder="Trayectoria Estudiantil UFT"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-3 px-6 rounded-xl bg-[#092c4c] text-white font-bold text-sm hover:bg-[#0c3c66] transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Save className="w-4 h-4" />
                Guardar Configuración en MongoDB Atlas
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Columna Derecha: Pruebas en Vivo */}
      <div className="lg:col-span-5 space-y-6">
        {/* Test General */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#3a9ad9]" />
            Prueba de Conectividad General
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Envía un correo institucional de prueba para verificar la autenticación.
          </p>

          <form onSubmit={handleTestEmail} className="space-y-3">
            <input
              type="email"
              placeholder="Ingresa tu correo de prueba..."
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono"
              required
            />
            <button
              type="submit"
              disabled={isTesting}
              className="w-full py-2.5 px-4 rounded-xl bg-[#3a9ad9] text-white text-xs font-bold hover:bg-[#2b83bd] transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isTesting ? 'Enviando prueba...' : 'Enviar Correo de Prueba'}
            </button>
          </form>

          {testResult && (
            <div className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
              testResult.status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {testResult.status === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Test Tutor Reminder */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-600" />
            Simulación: Recordatorio 1 Día Antes a Tutor
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Envía la plantilla de recordatorio con conteo de inscritos a un correo.
          </p>

          <form onSubmit={handleTestTutorReminder} className="space-y-3">
            <input
              type="email"
              placeholder="Correo del tutor (ej: alikevincuenta@gmail.com)"
              value={testTutorRecipient}
              onChange={(e) => setTestTutorRecipient(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono"
              required
            />
            <button
              type="submit"
              disabled={isTestingTutor}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isTestingTutor ? 'Enviando...' : 'Probar Recordatorio a Tutor'}
            </button>
          </form>

          {tutorTestResult && (
            <div className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
              tutorTestResult.status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {tutorTestResult.status === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{tutorTestResult.message}</span>
            </div>
          )}
        </div>

        {/* Test Inconvenience Alert */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Simulación: Aviso de Inconveniente de Alumno
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Envía la plantilla de alerta por tope de horario a los docentes.
          </p>

          <form onSubmit={handleTestInconvenienceAlert} className="space-y-3">
            <input
              type="email"
              placeholder="Correo del docente (ej: kevincastro.d05@gmail.com)"
              value={testInconvenienceRecipient}
              onChange={(e) => setTestInconvenienceRecipient(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3a9ad9] focus:outline-none font-mono"
              required
            />
            <button
              type="submit"
              disabled={isTestingInconvenience}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isTestingInconvenience ? 'Enviando...' : 'Probar Aviso a Docente'}
            </button>
          </form>

          {inconvenienceTestResult && (
            <div className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
              inconvenienceTestResult.status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {inconvenienceTestResult.status === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{inconvenienceTestResult.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
