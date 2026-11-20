import http from 'http';
import express from 'express';
import helmet from 'helmet';
import { connectDB } from './db.js';
import { checkRequiredEnv } from './config/env.js';
import { generalLimiter } from './middlewares/rateLimiters.js';
import { checkDb } from './middlewares/checkDb.js';
import apiRouter from './routes/index.js';
import { startCronJobs } from './services/cron.service.js';
import { initSocket } from './services/socket.service.js';

checkRequiredEnv();

const app = express();
// Vercel (y el proxy de Vite) reenvían la petición: la IP real del cliente viene en X-Forwarded-For
app.set('trust proxy', 1);
const server = http.createServer(app);

// Inicializar Socket.io sobre el servidor HTTP
initSocket(server);

// Seguridad de Cabeceras HTTP
// Las respuestas de este servidor son JSON (la página la sirve Vercel/Vite): CSP cerrada, sin marcos ni caché de datos.
// Las cabeceras de la página están en vercel.json.
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '1mb' }));

// Rate Limiter General para la API
app.use('/api', generalLimiter);

// Verificación de conexión a Base de Datos
app.use(checkDb);

// Conectar a MongoDB Atlas al iniciar
connectDB().then(async () => {
  console.log("Servidor API conectado a MongoDB Atlas");
}).catch((err) => {
  console.error("No se pudo conectar a la base de datos", err);
});

// Montar router maestro de la API
app.use('/api', apiRouter);

// Rutas inexistentes y errores no controlados (JSON malformado, cuerpo muy grande...) siempre responden JSON,
// sin trazas ni rutas internas del servidor (RB-01, RB-03).
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(`[500] ${req.method} ${req.originalUrl}:`, err);
  const message = status === 413 ? 'La petición es demasiado grande.' : status === 400 ? 'La petición no es válida.' : 'Error interno del servidor.';
  res.status(status).json({ error: message });
});

// Iniciar cron jobs automáticos de recordatorios
startCronJobs();

// Exportar app para despliegue Serverless (Vercel)
export default app;

// Iniciar servidor local si se ejecuta directamente con Node/tsx
if (process.env.NODE_ENV !== 'production' || process.env.RUN_STANDALONE === 'true') {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Servidor API modular con WebSockets escuchando en el puerto ${PORT}`);
  });
}
