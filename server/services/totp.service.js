import crypto from 'crypto';

// TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) compatible con Google Authenticator, Microsoft Authenticator y Authy.
// Implementado con crypto de Node para no sumar dependencias.
const STEP_S = 30;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const generateSecret = () => {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
};

const base32Decode = (s) => {
  let bits = '';
  for (const c of String(s).toUpperCase().replace(/=+$/, '')) {
    const v = B32.indexOf(c);
    if (v < 0) throw new Error('Secreto TOTP no válido');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};

export const totpAt = (secret, step) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, '0');
};

// Devuelve el paso (número) que coincide, o null. Acepta ±1 paso por diferencia de reloj.
export const verifyTotp = (secret, code, now = Date.now()) => {
  const clean = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const current = Math.floor(now / 1000 / STEP_S);
  for (const step of [current, current - 1, current + 1]) {
    const expected = Buffer.from(totpAt(secret, step));
    if (crypto.timingSafeEqual(expected, Buffer.from(clean))) return step;
  }
  return null;
};

// URI corta (sin parámetros que ya son los valores por defecto: SHA1, 6 dígitos, 30 s) para que el QR sea
// pequeño y fácil de leer; las apps autenticadoras asumen esos valores.
export const otpauthUri = (secret, account, issuer = 'Trayectoria UFT') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
