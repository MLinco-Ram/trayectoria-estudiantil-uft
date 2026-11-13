import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { MongoRateLimitStore } from './mongoRateLimitStore.js';
import { readSessionCookie, verifySessionToken } from '../services/session.service.js';

// En una sala de clases todos los alumnos salen a internet con la MISMA IP de la universidad.
// Por eso los límites no pueden ser solo por IP: 24 alumnos agotaban en segundos un tope pensado
// para una persona ("Demasiados intentos" en el primer intento). Se cuenta por cuenta/identificador,
// y el tope por IP queda solo como freno amplio contra ataques masivos.

const ipKey = (req) => ipKeyGenerator(req.ip || '');
const normalizeIdentifier = (value) => String(value || '').trim().toLowerCase().replace(/[.\s-]/g, '');

// Limitador general de la API: por usuario en sesión (o por IP si no hay sesión)
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req) => (verifySessionToken(readSessionCookie(req)) ? 300 : 600),
  keyGenerator: (req) => {
    const session = verifySessionToken(readSessionCookie(req));
    return session?.uid ? `user:${session.uid}` : `ip:${ipKey(req)}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones en poco tiempo. Espera un minuto e intenta de nuevo.' }
});

// Login: 10 intentos FALLIDOS en 5 min por cuenta (RUT o correo) desde una IP.
// Los ingresos correctos no cuentan, así cerrar sesión y volver a entrar no bloquea.
export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKey(req)}|${normalizeIdentifier(req.body?.rut)}`,
  standardHeaders: true,
  legacyHeaders: false,
  // Contador compartido entre instancias; si Mongo falla se deja pasar en vez de bloquear el login
  store: new MongoRateLimitStore('login'),
  passOnStoreError: true,
  message: { error: 'Demasiados intentos fallidos con esta cuenta. Por seguridad, espera 5 minutos antes de reintentar.' }
});

// Freno amplio por IP para el login (cubre a un curso completo entrando a la vez)
export const loginIpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  skipSuccessfulRequests: true,
  keyGenerator: ipKey,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore('login-ip'),
  passOnStoreError: true,
  message: { error: 'Demasiados intentos fallidos desde esta red. Espera 5 minutos antes de reintentar.' }
});

// Registro de alumnos: contador propio (antes compartía el del login), solo cuentan los fallidos
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skipSuccessfulRequests: true,
  keyGenerator: ipKey,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore('register'),
  passOnStoreError: true,
  message: { error: 'Demasiados intentos de registro desde esta red. Espera 15 minutos.' }
});

// Cambio de contraseña con sesión: por usuario (va después de requireAuth), solo cuentan los fallidos
export const changePasswordLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `user:${req.user?.id || ipKey(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore('change-password'),
  passOnStoreError: true,
  message: { error: 'Demasiados intentos de cambio de contraseña. Espera 5 minutos.' }
});

// Recuperación de contraseña: 5 solicitudes cada 15 min por cuenta (RUT o correo) desde una IP
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${ipKey(req)}|${normalizeIdentifier(req.body?.identifier || req.body?.rut || req.body?.email)}`,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore('forgot-password'),
  passOnStoreError: true,
  message: { error: 'Demasiadas solicitudes de restablecimiento para esta cuenta. Por favor, espera 15 minutos.' }
});

// Guardar la nueva contraseña con el enlace del correo: por token, solo cuentan los fallidos
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKey(req)}|${String(req.body?.token || '').slice(0, 64)}`,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore('reset-password'),
  passOnStoreError: true,
  message: { error: 'Demasiados intentos con este enlace. Espera 15 minutos o solicita uno nuevo.' }
});
