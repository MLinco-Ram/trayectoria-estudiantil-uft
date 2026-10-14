import rateLimit from 'express-rate-limit';
import { MongoRateLimitStore } from './mongoRateLimitStore.js';

// Rate Limiter General para la API (120 peticiones por minuto por IP)
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones desde esta IP, por favor intenta de nuevo en un minuto." }
});

// Rate Limiter Estricto para Login (Anti Fuerza Bruta: máx 10 intentos por cada 5 minutos)
export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Contador compartido entre instancias; si Mongo falla se deja pasar en vez de bloquear el login
  store: new MongoRateLimitStore('login'),
  passOnStoreError: true,
  message: { error: "Demasiados intentos fallidos de inicio de sesión. Por seguridad, espera 5 minutos antes de reintentar." }
});

// Rate Limiter para recuperación de contraseña (máx 5 solicitudes cada 15 min por IP)
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: new MongoRateLimitStore('forgot-password'),
  passOnStoreError: true,
  message: { error: "Demasiadas solicitudes de restablecimiento de contraseña. Por favor, espera 15 minutos." }
});
