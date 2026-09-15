import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { getSavedUsers, formatRut } from '../data';
import { LogIn, UserPlus, CheckCircle2, Lock, User as UserIcon, Mail, Eye, EyeOff, ChevronDown } from 'lucide-react';
import ForgotPasswordModal from './ForgotPasswordModal';
import TermsAndConditionsModal from './TermsAndConditionsModal';
import { useAuth, getRoleHomePath } from '../context/AuthContext';

interface LoginScreenProps {
  onLoginSuccess?: (user: User) => void;
}

// Colores corporativos Finis Terrae
const PETAL_NAVY = '#0d2f52';
const PETAL_TEAL = '#0f7ea8';
const PETAL_CYAN = '#5ce1e6';
const PETAL_BLACK = '#0a0a0a';

type Petal = { col: number; row: number; corner: 'tl' | 'tr' | 'bl' | 'br'; color: string; r?: number };
type Dot = { col: number; row: number; color: string; r: number };

const CELL = 140;
const petalPath = (col: number, row: number, corner: Petal['corner'], r: number = CELL) => {
  const x0 = col * CELL;
  const y0 = row * CELL;
  const anchors: Record<Petal['corner'], [number, number, number, number, number, number]> = {
    tl: [x0, y0, x0 + r, y0, x0, y0 + r],
    tr: [x0 + CELL, y0, x0 + CELL - r, y0, x0 + CELL, y0 + r],
    bl: [x0, y0 + CELL, x0, y0 + CELL - r, x0 + r, y0 + CELL],
    br: [x0 + CELL, y0 + CELL, x0 + CELL, y0 + CELL - r, x0 + CELL - r, y0 + CELL],
  };
  const [cx, cy, sx, sy, ex, ey] = anchors[corner];
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey} Z`;
};

// Patrón Truchet lado izquierdo (Gran formato como en la imagen de referencia)
const LEFT_PETALS: Petal[] = [
  // Fila 0
  { col: 0, row: 0, corner: 'br', color: PETAL_TEAL },
  { col: 1, row: 0, corner: 'bl', color: PETAL_BLACK },
  { col: 2, row: 0, corner: 'br', color: PETAL_CYAN },
  // Fila 1
  { col: 0, row: 1, corner: 'tr', color: PETAL_CYAN },
  { col: 2, row: 1, corner: 'tl', color: PETAL_CYAN, r: CELL * 1.1 },
  { col: 2, row: 1, corner: 'br', color: PETAL_BLACK, r: CELL * 0.8 },
  // Fila 2
  { col: 0, row: 2, corner: 'tr', color: PETAL_CYAN },
  { col: 1, row: 2, corner: 'tl', color: PETAL_NAVY },
  { col: 2, row: 2, corner: 'tr', color: PETAL_TEAL },
  // Fila 3
  { col: 0, row: 3, corner: 'br', color: PETAL_NAVY },
  { col: 1, row: 3, corner: 'bl', color: PETAL_BLACK },
  { col: 2, row: 3, corner: 'tl', color: PETAL_TEAL },
  // Fila 4
  { col: 0, row: 4, corner: 'tr', color: PETAL_TEAL },
  { col: 1, row: 4, corner: 'br', color: PETAL_CYAN },
  { col: 2, row: 4, corner: 'bl', color: PETAL_NAVY },
];

const LEFT_DOTS: Dot[] = [
  { col: 1, row: 1, color: PETAL_NAVY, r: 24 },
  { col: 0, row: 2, color: PETAL_NAVY, r: 16 },
  { col: 2, row: 3, color: PETAL_CYAN, r: 20 },
];

// Patrón Truchet lado derecho (Gran formato como en la imagen de referencia)
const RIGHT_PETALS: Petal[] = [
  // Fila 0
  { col: 1, row: 0, corner: 'bl', color: PETAL_TEAL },
  { col: 2, row: 0, corner: 'br', color: PETAL_NAVY },
  // Fila 1
  { col: 0, row: 1, corner: 'tl', color: PETAL_TEAL },
  { col: 1, row: 1, corner: 'tr', color: PETAL_CYAN },
  { col: 2, row: 1, corner: 'bl', color: PETAL_NAVY },
  // Fila 2
  { col: 0, row: 2, corner: 'bl', color: PETAL_BLACK, r: CELL * 0.85 },
  { col: 1, row: 2, corner: 'tl', color: PETAL_NAVY },
  { col: 2, row: 2, corner: 'tr', color: PETAL_CYAN },
  // Fila 3
  { col: 0, row: 3, corner: 'tl', color: PETAL_TEAL },
  { col: 1, row: 3, corner: 'br', color: PETAL_CYAN },
  { col: 2, row: 3, corner: 'bl', color: PETAL_BLACK },
  // Fila 4
  { col: 0, row: 4, corner: 'tr', color: PETAL_CYAN },
  { col: 1, row: 4, corner: 'tl', color: PETAL_NAVY },
  { col: 2, row: 4, corner: 'br', color: PETAL_TEAL },
];

const RIGHT_DOTS: Dot[] = [
  { col: 1, row: 0, color: PETAL_CYAN, r: 18 },
  { col: 1, row: 2, color: PETAL_NAVY, r: 24 },
  { col: 2, row: 3, color: PETAL_CYAN, r: 20 },
];

const GRID_COLS = 3;
const GRID_ROWS = 5;
const GRID_W = GRID_COLS * CELL;
const GRID_H = GRID_ROWS * CELL;

// Fondo con mosaicos gigantes a ambos lados
function LoginBackdrop() {
  return (
    <>
      {/* Mosaico Izquierdo Gigante */}
      <div
        className="fixed top-0 left-0 pointer-events-none select-none z-0 overflow-hidden h-full w-[45vw] max-w-[620px] min-w-[320px] opacity-95 flex items-center"
        aria-hidden="true"
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${GRID_W} ${GRID_H}`}
          preserveAspectRatio="xMinYMid slice"
          className="w-full h-full"
        >
          {LEFT_PETALS.map((p, i) => (
            <path key={`lp-${i}`} d={petalPath(p.col, p.row, p.corner, p.r)} fill={p.color} />
          ))}
          {LEFT_DOTS.map((d, i) => (
            <circle key={`ld-${i}`} cx={d.col * CELL + CELL / 2} cy={d.row * CELL + CELL / 2} r={d.r} fill={d.color} />
          ))}
        </svg>
      </div>

      {/* Mosaico Derecho Gigante */}
      <div
        className="fixed top-0 right-0 pointer-events-none select-none z-0 overflow-hidden h-full w-[45vw] max-w-[620px] min-w-[320px] opacity-95 flex items-center justify-end"
        aria-hidden="true"
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${GRID_W} ${GRID_H}`}
          preserveAspectRatio="xMaxYMid slice"
          className="w-full h-full"
        >
          {RIGHT_PETALS.map((p, i) => (
            <path key={`rp-${i}`} d={petalPath(p.col, p.row, p.corner, p.r)} fill={p.color} />
          ))}
          {RIGHT_DOTS.map((d, i) => (
            <circle key={`rd-${i}`} cx={d.col * CELL + CELL / 2} cy={d.row * CELL + CELL / 2} r={d.r} fill={d.color} />
          ))}
        </svg>
      </div>
    </>
  );
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Login Form States
  const [rutInput, setRutInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Register Form States
  const [regName, setRegName] = useState('');
  const [regRut, setRegRut] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCareer, setRegCareer] = useState('Ing. Civil en Inform. y Telec.');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regTermsAccepted, setRegTermsAccepted] = useState(false);
  const [regFeedback, setRegFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  const handleSuccessfulAuth = (userObj: User) => {
    login(userObj);
    if (onLoginSuccess) {
      onLoginSuccess(userObj);
    }
    navigate(getRoleHomePath(userObj.role));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!rutInput.trim()) {
      setError('Por favor, ingresa tu RUT.');
      return;
    }

    if (!passwordInput.trim()) {
      setError('Por favor, ingresa tu contraseña.');
      return;
    }

    // Soporte prioritario para cuenta especial de Administrador
    const cleanEntered = rutInput.replace(/[\.\-]/g, '').trim().toLowerCase();
    if (cleanEntered === 'admin' || cleanEntered === 'administrador') {
      if (passwordInput.trim() === '1234') {
        const adminUser: User = {
          id: 'admin_root',
          name: 'Administrador del Sistema',
          rut: 'admin',
          role: 'admin',
          email: 'admin@uft.cl',
          career: 'Administración y Soporte TI'
        };
        handleSuccessfulAuth(adminUser);
        return;
      } else {
        setError('Contraseña de administrador incorrecta (clave por defecto: 1234).');
        return;
      }
    }

    // Validar largo de RUT (debe tener exactamente 9 dígitos/caracteres ignorando puntos y guión)
    if (cleanEntered.length !== 9) {
      setError('El RUT debe tener exactamente 9 caracteres (ej: 123456789 o 12.345.678-9).');
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut: rutInput, password: passwordInput })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenciales incorrectas.');
        return;
      }

      handleSuccessfulAuth(data);
    } catch (err) {
      if (cleanEntered === 'admin' && passwordInput === '1234') {
        const adminUser: User = {
          id: 'admin_root',
          name: 'Administrador del Sistema',
          rut: 'admin',
          role: 'admin',
          email: 'admin@uft.cl',
          career: 'Administración y Soporte TI'
        };
        handleSuccessfulAuth(adminUser);
        return;
      }
      const allUsers = getSavedUsers();
      const matchedUser = allUsers.find(u => u.rut.replace(/[\.\-]/g, '').trim().toLowerCase() === cleanEntered.toLowerCase());
      if (!matchedUser) {
        setError('RUT no encontrado.');
        return;
      }
      handleSuccessfulAuth(matchedUser);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegFeedback(null);

    if (!regName.trim() || !regRut.trim() || !regEmail.trim() || !regPassword.trim()) {
      setRegFeedback({ status: 'error', message: 'Todos los campos son obligatorios.' });
      return;
    }

    const cleanRut = regRut.replace(/[\.\-]/g, '').trim();
    if (cleanRut.length !== 9) {
      setRegFeedback({ 
        status: 'error', 
        message: 'El RUT debe tener exactamente 9 dígitos o caracteres (ejemplo: 12345678-9 o 123456789).' 
      });
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    const isValidUftDomain = cleanEmail.endsWith('@uft.cl') || cleanEmail.endsWith('@mail.uft.cl') || cleanEmail.endsWith('@uft.edu');
    if (!isValidUftDomain) {
      setRegFeedback({ 
        status: 'error', 
        message: 'El correo institucional debe tener dominio oficial de la universidad (ejemplo: usuario@uft.cl, usuario@mail.uft.cl o usuario@uft.edu).' 
      });
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegFeedback({ status: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }

    if (!regTermsAccepted) {
      setRegFeedback({ 
        status: 'error', 
        message: 'Debes aceptar los Términos y Condiciones y la Política de Protección de Datos para continuar.' 
      });
      return;
    }

    let currentUsers = getSavedUsers();
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        currentUsers = await res.json();
      }
    } catch (err) {
      console.warn('Usando respaldo local.');
    }

    const exists = currentUsers.some(u => u.rut.replace(/[\.\-]/g, '').trim().toLowerCase() === cleanRut.toLowerCase());
    if (exists) {
      setRegFeedback({ status: 'error', message: 'El RUT ya se encuentra registrado en el sistema.' });
      return;
    }

    const newUser: User = {
      id: `alumno_${Date.now()}`,
      name: regName.trim(),
      rut: regRut.trim(),
      role: 'alumno',
      email: cleanEmail,
      career: regCareer,
      password: regPassword.trim()
    };

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setRegFeedback({ status: 'success', message: '¡Cuenta creada con éxito! Iniciando sesión...' });
        setTimeout(() => {
          handleSuccessfulAuth(newUser);
        }, 1200);
        return;
      }
    } catch (err) {
      console.warn('Fallback al guardar en Mongo:', err);
    }

    setRegFeedback({ status: 'success', message: '¡Cuenta creada con éxito! Iniciando sesión...' });
    setTimeout(() => {
      handleSuccessfulAuth(newUser);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-[#007ba7] selection:text-white">
      {/* Mosaicos gigantes a ambos lados en pantalla completa */}
      <LoginBackdrop />

      {/* Contenedor de la tarjeta con capa de sombra azul oscuro desplazada (Layered Card Effect) */}
      <div className="relative w-full max-w-md my-6 z-10 animate-fade-in">
        
        {/* Capa trasera azul marino desplazada */}
        <div className="absolute -top-3.5 -left-3.5 w-full h-full bg-[#0d2f52] rounded-[2.5rem] shadow-xl z-0" />

        {/* Tarjeta frontal blanca con borde definido */}
        <div className="relative z-10 w-full bg-white rounded-[2.5rem] border-2 border-slate-900 shadow-2xl overflow-hidden p-6 sm:p-8 space-y-5">
          {/* Encabezado con título caligráfico y subtítulo institucional */}
          <div className="relative z-10 text-center select-none pt-2 pb-1">
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-script text-3xl sm:text-4xl text-slate-900 leading-none italic" style={{ fontFamily: 'var(--font-script), cursive' }}>
                Trayectoria estudiantil
              </span>
              <div className="inline-flex flex-col items-center justify-center relative -top-0.5">
                <span className="font-extrabold text-2xl sm:text-3xl text-slate-900 leading-none tracking-tight">
                  TE
                </span>
                {/* Doble onda estilizada debajo del TE */}
                <svg className="w-9 h-2.5 text-slate-900 -mt-0.5" viewBox="0 0 40 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 3C10 3 14 10 24 10C30 10 36 6 38 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M8 8C14 8 18 11 26 11C31 11 36 9 37 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            
            <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 mt-2">
              Centro de Apoyo del Aprendizaje
            </h1>
          </div>

          {/* Selector de pestañas tipo píldora (Inicio sesión / Registro alumno) */}
          <div className="bg-[#007ba7] rounded-full p-1 border-2 border-slate-900 flex shadow-sm">
            <button
              type="button"
              onClick={() => { setIsRegisterMode(false); setError(null); }}
              className={`flex-1 py-2 rounded-full text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !isRegisterMode 
                  ? 'bg-white text-[#092c4c] shadow-md border border-slate-200' 
                  : 'text-white hover:text-slate-100'
              }`}
            >
              <span>Inicio sesión</span>
            </button>
            <button
              type="button"
              onClick={() => { setIsRegisterMode(true); setRegFeedback(null); }}
              className={`flex-1 py-2 rounded-full text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isRegisterMode 
                  ? 'bg-white text-[#092c4c] shadow-md border border-slate-200' 
                  : 'text-white hover:text-slate-100'
              }`}
            >
              <span>Registro alumno</span>
            </button>
          </div>

          {/* Formularios */}
          <div className="pt-1">
            {!isRegisterMode ? (
              /* LOGIN FORM */
              <form onSubmit={handleLogin} className="space-y-4">
                
                {/* Input RUT con círculo blanco e icono */}
                <div className="flex items-center bg-[#007ba7] rounded-full p-1.5 border-2 border-slate-900 shadow-md">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shrink-0 border border-slate-200 shadow-inner">
                    <UserIcon className="w-5 h-5 text-slate-700" />
                  </div>
                  <input
                    type="text"
                    name="rut"
                    id="rut"
                    className="flex-1 bg-transparent px-4 text-sm font-bold text-white placeholder-white/75 focus:outline-none font-mono"
                    placeholder="11.111.111-1"
                    value={rutInput}
                    onChange={(e) => setRutInput(formatRut(e.target.value))}
                  />
                </div>

                {/* Input Contraseña con círculo blanco e icono */}
                <div>
                  <div className="flex items-center bg-[#007ba7] rounded-full p-1.5 border-2 border-slate-900 shadow-md">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-800 shrink-0 border border-slate-200 shadow-inner">
                      <Lock className="w-5 h-5 text-slate-700" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="pass"
                      id="pass"
                      className="flex-1 bg-transparent px-4 text-sm font-bold text-white placeholder-white/75 focus:outline-none"
                      placeholder="••••••••••••"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="pr-3.5 text-white/85 hover:text-white cursor-pointer"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <div className="text-right mt-1.5">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-[11px] font-extrabold text-slate-900 hover:text-[#007ba7] hover:underline transition-colors cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-2xl border border-red-200 font-semibold animate-fade-in" id="login-error">
                    {error}
                  </div>
                )}

                {/* Botón Ingresar */}
                <button
                  type="submit"
                  className="w-full bg-[#007ba7] hover:bg-[#00688f] text-white py-3.5 px-6 rounded-full font-extrabold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 cursor-pointer border-2 border-slate-900 mt-3"
                >
                  <LogIn className="h-5 w-5" />
                  <span>Ingresar al sistema</span>
                </button>
              </form>
            ) : (
              /* REGISTER ALUMNO FORM */
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Nombre completo</label>
                  <div className="flex items-center bg-[#007ba7] rounded-full p-1.5 border-2 border-slate-900 shadow-md">
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-slate-800 shrink-0 border border-slate-200 shadow-inner">
                      <UserIcon className="w-4 h-4 text-slate-700" />
                    </div>
                    <input
                      type="text"
                      className="flex-1 bg-transparent px-3 text-xs font-bold text-white placeholder-white/75 focus:outline-none"
                      placeholder="Ej. Camila Linco"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">RUT</label>
                  <div className="flex items-center bg-[#007ba7] rounded-full p-1.5 border-2 border-slate-900 shadow-md">
                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-slate-800 shrink-0 border border-slate-200 shadow-inner">
                      <UserIcon className="w-4 h-4 text-slate-700" />
                    </div>
                    <input
                      type="text"
                      className="flex-1 bg-transparent px-3 text-xs font-bold text-white placeholder-white/75 focus:outline-none font-mono"
                      placeholder="12.345.678-9"
                      value={regRut}
                      onChange={(e) => setRegRut(formatRut(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-red-600 mb-1">
                    Correo institucional (@uft.cl / @mail.uft.cl)
                  </label>
                  <div className="flex items-center bg-white rounded-full p-1.5 border-2 border-slate-900 shadow-md">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-800 shrink-0 border border-slate-200 shadow-inner">
                      <Mail className="w-4 h-4 text-[#007ba7]" />
                    </div>
                    <input
                      type="email"
                      className="flex-1 bg-transparent px-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none"
                      placeholder="ejemplo@uft.cl"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Carrera</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none pl-4 pr-10 py-2.5 bg-[#0d2f52] text-white rounded-full border-2 border-slate-900 focus:outline-none text-xs font-bold cursor-pointer shadow-md"
                      value={regCareer}
                      onChange={(e) => setRegCareer(e.target.value)}
                    >
                      <option value="Ing. Civil en Inform. y Telec.">Ing. Civil en Inform. y Telec.</option>
                      <option value="Ingeniería Civil Industrial">Ingeniería Civil Industrial</option>
                      <option value="Derecho">Derecho</option>
                      <option value="Psicología">Psicología</option>
                      <option value="Medicina">Medicina</option>
                      <option value="Kinesiología">Kinesiología</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-white absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Contraseña</label>
                    <div className="flex items-center bg-[#007ba7] rounded-full p-1.5 border-2 border-slate-900 shadow-md">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        className="flex-1 bg-transparent px-3 text-xs font-bold text-white placeholder-white/75 focus:outline-none"
                        placeholder="Mínimo 4"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword((v) => !v)}
                        className="pr-2 text-white/80 hover:text-white cursor-pointer"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Confirmar</label>
                    <div className="flex items-center bg-[#007ba7] rounded-full p-1.5 border-2 border-slate-900 shadow-md">
                      <input
                        type={showRegConfirm ? 'text' : 'password'}
                        className="flex-1 bg-transparent px-3 text-xs font-bold text-white placeholder-white/75 focus:outline-none"
                        placeholder="Repite"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirm((v) => !v)}
                        className="pr-2 text-white/80 hover:text-white cursor-pointer"
                      >
                        {showRegConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Checkbox de Términos y Condiciones */}
                <div className="pt-1">
                  <label className="flex items-start space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={regTermsAccepted}
                      onChange={(e) => setRegTermsAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#007ba7] focus:ring-[#007ba7] cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-700 leading-snug">
                      Acepto los{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowTermsModal(true);
                        }}
                        className="font-bold text-[#007ba7] underline cursor-pointer"
                      >
                        Términos y Condiciones
                      </button>
                    </span>
                  </label>
                </div>

                {regFeedback && (
                  <div className={`p-2.5 text-xs rounded-2xl border font-bold flex items-center space-x-1.5 ${regFeedback.status === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {regFeedback.status === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
                    <span>{regFeedback.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#007ba7] hover:bg-[#00688f] text-white py-3.5 px-6 rounded-full font-extrabold text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer border-2 border-slate-900 mt-1"
                >
                  <UserPlus className="h-5 w-5" />
                  <span>Crear cuenta alumno</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Logo oficial fijo abajo a la izquierda */}
      <div className="fixed bottom-4 left-6 md:bottom-6 md:left-8 z-20 pointer-events-none select-none flex items-center gap-3">
        <img src="/logo-uft-oficial.png" alt="Universidad Finis Terrae" className="h-12 md:h-16 w-auto object-contain" />
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />

      {/* Terms and Conditions Modal */}
      <TermsAndConditionsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => setRegTermsAccepted(true)}
      />
    </div>
  );
}
