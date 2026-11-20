import { Server } from 'socket.io';
import { readSessionCookie, verifySessionToken } from './session.service.js';
import { getOrConnectDB } from '../db.js';

const emailRoom = (email) => `email:${String(email).trim().toLowerCase()}`;

let ioInstance = null;

// Orígenes que pueden abrir el WebSocket: el sitio publicado (y, en desarrollo, el servidor local)
function allowedOrigins() {
  const origins = [process.env.APP_URL || 'https://trayectoria-estudiantil-uft.vercel.app'];
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001');
  }
  return origins.map(o => o.replace(/\/$/, ''));
}

export function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: allowedOrigins(),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Solo se conectan clientes con una sesión válida (la misma cookie httpOnly de la API)
  // Cada conexión entra a la sala de su propio correo: los avisos dirigidos a una persona solo le llegan a ella (NO-07).
  ioInstance.use(async (socket, next) => {
    const session = verifySessionToken(readSessionCookie({ headers: socket.request.headers }));
    if (!session) return next(new Error('Sesión no válida'));
    try {
      const db = await getOrConnectDB();
      const user = await db.collection('users').findOne({ id: session.uid }, { projection: { email: 1, sessionVersion: 1 } });
      if (!user || (session.sv ?? 0) !== (user.sessionVersion ?? 0)) return next(new Error('Sesión no válida'));
      if (user.email) socket.join(emailRoom(user.email));
      next();
    } catch {
      next(new Error('Sesión no válida'));
    }
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

// Los eventos en tiempo real solo avisan QUE algo cambió; los datos se piden por la API, que filtra según el rol.
// Así un cliente conectado nunca recibe por el socket RUT, mensajes ni datos de otras personas.
const SAFE_KEYS = ['action', 'id', 'sessionId', 'userId', 'reportId', 'requestId', 'roomId'];
function safePayload(data) {
  const out = {};
  for (const key of SAFE_KEYS) {
    if (typeof data?.[key] === 'string') out[key] = data[key];
  }
  return out;
}

export function emitEvent(event, data) {
  if (!ioInstance) return;
  // Un aviso dirigido a una persona se emite solo a su sala; nunca se envía el correo del destinatario a los demás
  const toEmail = data?.notification?.toEmail;
  if (typeof toEmail === 'string' && toEmail.trim()) {
    ioInstance.to(emailRoom(toEmail)).emit(event, safePayload(data));
    return;
  }
  ioInstance.emit(event, safePayload(data));
}
