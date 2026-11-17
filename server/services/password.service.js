import crypto from 'crypto';

// Contraseñas iniciales aleatorias (nunca derivadas de datos personales) y política de contraseñas.

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // sin I ni O
const LOWER = 'abcdefghijkmnpqrstuvwxyz';   // sin l ni o
const DIGITS = '23456789';                  // sin 0 ni 1
const ALL = UPPER + LOWER + DIGITS;

// La contraseña inicial es temporal: pasado este plazo hay que pedir una nueva con "¿Olvidaste tu contraseña?"
export const INITIAL_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const pick = (chars) => chars[crypto.randomInt(chars.length)];

export function generateInitialPassword(length = 10) {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Mezcla Fisher-Yates con aleatoriedad criptográfica
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const initialPasswordExpiry = () => new Date(Date.now() + INITIAL_PASSWORD_TTL_MS).toISOString();

export const isInitialPasswordExpired = (user) =>
  Boolean(user?.initialPasswordExpiresAt) && Date.parse(user.initialPasswordExpiresAt) < Date.now();

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72; // bcrypt ignora lo que pase de 72 bytes

// Contraseñas filtradas más usadas (en español e inglés) y variantes típicas de la plataforma
const COMMON = new Set([
  '12345678', '123456789', '1234567890', '987654321', '11111111', '00000000', 'abcd1234', 'abc12345',
  'qwerty123', 'qwertyui', 'password', 'password1', 'password123', 'passw0rd', 'contrasena', 'contrasena1',
  'contrasena123', 'iloveyou', 'admin123', 'administrador', 'bienvenido', 'bienvenida1', 'chile123', 'chile2026',
  'uft12345', 'uft2026', 'uft2025', 'finisterrae', 'finisterrae1', 'trayectoria', 'trayectoria1', 'trayectoria2026',
  'universidad', 'universidad1', 'alumno123', 'alumno2026', 'tutor123', 'docente123', 'estudiante1',
]);

const normalize = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Devuelve el motivo del rechazo o null si la contraseña es válida.
// `personal` recibe datos de la cuenta (rut, email, name) para impedir contraseñas derivadas de ellos.
export function validatePasswordPolicy(password, personal = {}) {
  const pwd = typeof password === 'string' ? password.trim() : '';
  if (pwd.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (pwd.length > PASSWORD_MAX_LENGTH) return `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`;
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(pwd) || !/\d/.test(pwd)) {
    return 'La contraseña debe combinar letras y números.';
  }
  const flat = normalize(pwd).replace(/[^a-z0-9]/g, '');
  if (COMMON.has(flat) || /^(.)\1+$/.test(flat)) return 'Esa contraseña es demasiado común. Elige otra.';

  const rut = String(personal.rut || '').replace(/[.\-\s]/g, '').toLowerCase();
  if (rut.length >= 8) {
    const body = rut.slice(0, -1); // RUT sin dígito verificador
    if (flat.includes(rut) || flat.includes(body)) return 'La contraseña no puede contener tu RUT.';
  }
  const emailUser = normalize(String(personal.email || '').split('@')[0]).replace(/[^a-z0-9]/g, '');
  if (emailUser.length >= 5 && flat.includes(emailUser)) return 'La contraseña no puede contener tu correo.';
  return null;
}
