// Política de contraseñas (la misma que valida el servidor en server/services/password.service.js).
// El servidor siempre vuelve a validar: esto solo da el mensaje antes de enviar.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HINT = 'Mínimo 8 caracteres, con letras y números.';

const COMMON = new Set([
  '12345678', '123456789', '1234567890', '987654321', '11111111', '00000000', 'abcd1234', 'abc12345',
  'qwerty123', 'qwertyui', 'password', 'password1', 'password123', 'passw0rd', 'contrasena', 'contrasena1',
  'contrasena123', 'iloveyou', 'admin123', 'administrador', 'bienvenido', 'bienvenida1', 'chile123', 'chile2026',
  'uft12345', 'uft2026', 'uft2025', 'finisterrae', 'finisterrae1', 'trayectoria', 'trayectoria1', 'trayectoria2026',
  'universidad', 'universidad1', 'alumno123', 'alumno2026', 'tutor123', 'docente123', 'estudiante1',
]);

const normalize = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Devuelve el motivo del rechazo o null si la contraseña es válida
export function checkPassword(password: string, personal: { rut?: string; email?: string } = {}): string | null {
  const pwd = (password || '').trim();
  if (pwd.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (pwd.length > 72) return 'La contraseña no puede superar los 72 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(pwd) || !/\d/.test(pwd)) return 'La contraseña debe combinar letras y números.';
  const flat = normalize(pwd).replace(/[^a-z0-9]/g, '');
  if (COMMON.has(flat) || /^(.)\1+$/.test(flat)) return 'Esa contraseña es demasiado común. Elige otra.';
  const rut = (personal.rut || '').replace(/[.\-\s]/g, '').toLowerCase();
  if (rut.length >= 8 && (flat.includes(rut) || flat.includes(rut.slice(0, -1)))) return 'La contraseña no puede contener tu RUT.';
  const emailUser = normalize((personal.email || '').split('@')[0]).replace(/[^a-z0-9]/g, '');
  if (emailUser.length >= 5 && flat.includes(emailUser)) return 'La contraseña no puede contener tu correo.';
  return null;
}
