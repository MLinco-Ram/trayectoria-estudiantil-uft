import http from 'http';
import express from 'express';
import helmet from 'helmet';
import { connectDB } from './db.js';
import { generalLimiter } from './middlewares/rateLimiters.js';
import { checkDb } from './middlewares/checkDb.js';
import apiRouter from './routes/index.js';
import { startCronJobs } from './services/cron.service.js';
import { initSocket } from './services/socket.service.js';

const app = express();
const server = http.createServer(app);

// Inicializar Socket.io sobre el servidor HTTP
initSocket(server);

// Seguridad de Cabeceras HTTP
app.use(
  helmet({
    contentSecurityPolicy: false, // Permitir fuentes e imágenes externas
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '1mb' }));

// Rate Limiter General para la API
app.use('/api', generalLimiter);

// Verificación de conexión a Base de Datos
app.use(checkDb);

// Conectar a MongoDB Atlas al iniciar
connectDB().then(async (db) => {
  console.log("Servidor API conectado a MongoDB Atlas");

  // Sincronización inicial de correos de prueba si no estuvieran presentes
  try {
    const tutor1 = await db.collection('users').findOne({ id: 'tutor_1' });
    if (tutor1 && !tutor1.email) {
      await db.collection('users').updateOne(
        { id: 'tutor_1' },
        { $set: { email: 'alikevincuenta@gmail.com' } }
      );
    }
    const docente1 = await db.collection('users').findOne({ id: 'docente_1' });
    if (docente1 && !docente1.email) {
      await db.collection('users').updateOne(
        { id: 'docente_1' },
        { $set: { email: 'kevincastro.d05@gmail.com' } }
      );
    }
  } catch (err) {
    console.warn("No se pudo sincronizar correos de prueba en Mongo:", err);
  }
}).catch((err) => {
  console.error("No se pudo conectar a la base de datos", err);
});

// Montar router maestro de la API
app.use('/api', apiRouter);

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
