import crypto from 'crypto';
import { requireEnv } from '../config/env.js';

// Sesiones firmadas con HMAC-SHA256 en una cookie httpOnly (el navegador no puede leerla ni editarla).
// El token solo guarda el id del usuario; roles y datos se leen de MongoDB en cada petición.
export const SESSION_COOKIE = 'uft_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getSessionSecret() {
  return requireEnv('SESSION_SECRET');
}

function sign(value) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

export function createSessionToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_MAX_AGE_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function readSessionCookie(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

export function setSessionCookie(res, userId) {
  res.cookie(SESSION_COOKIE, createSessionToken(userId), { ...cookieOptions(), maxAge: SESSION_MAX_AGE_MS });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}
