import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dns from 'dns';

// Algunos routers responden la consulta SRV de Atlas pero no la TXT (o bloquean DNS públicos),
// y el driver falla con "querySrv/queryTxt ETIMEOUT". En ese caso se resuelven los hosts por SRV
// y se conecta con una URI estándar mongodb:// que no necesita la consulta TXT.
const DNS_SYSCALLS = ['querySrv', 'queryTxt'];
let useStandardUri = false;

async function toStandardUri(srvUri) {
  const url = new URL(srvUri);
  const records = await dns.promises.resolveSrv(`_mongodb._tcp.${url.hostname}`);
  const hosts = records.map(r => `${r.name}:${r.port}`).join(',');
  const params = new URLSearchParams(url.search);
  if (!params.has('tls') && !params.has('ssl')) params.set('tls', 'true');
  if (!params.has('authSource')) params.set('authSource', 'admin');
  const auth = url.username ? `${url.username}:${url.password}@` : '';
  return `mongodb://${auth}${hosts}${url.pathname || '/'}?${params}`;
}

// Cargar variables de entorno desde el archivo .env clásico
dotenv.config();

const uri = process.env.MONGODB_URI || '';

let cachedClient = null;
let cachedDb = null;
let connecting = null;
let clientUsed = false;

// maxPoolSize bajo: cada instancia de Vercel abre su propio pool y el plan gratuito de Atlas admite 500 conexiones
const CLIENT_OPTIONS = { maxPoolSize: 10 };

export const client = uri ? new MongoClient(uri, CLIENT_OPTIONS) : null;

export async function connectDB() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!uri) {
    const errMsg = "MONGODB_URI no está configurada en las variables de entorno (.env)";
    console.warn(`⚠️ ${errMsg}`);
    throw new Error(errMsg);
  }

  // Conexión en curso compartida: peticiones simultáneas no abren varios clientes
  if (!connecting) {
    connecting = (async () => {
      // Tras un connect() fallido el cliente queda cerrado ("Topology is closed"): se usa uno nuevo
      let mongoClient = null;
      try {
        mongoClient = useStandardUri
          ? new MongoClient(await toStandardUri(uri), CLIENT_OPTIONS)
          : !cachedClient && client && !clientUsed ? client : new MongoClient(uri, CLIENT_OPTIONS);
        clientUsed = true;
        await mongoClient.connect();
        cachedClient = mongoClient;
        cachedDb = mongoClient.db('trayectoria_uft');
        // Índice del login por RUT (idempotente; no bloquea la conexión si falla)
        // Un RUT = una cuenta, garantizado por la base (dos registros simultáneos con el mismo RUT ya no pasan).
        // Reemplaza al índice simple rutHash_1; si hubiera RUT duplicados antiguos no se puede crear y se conserva el simple.
        (async () => {
          const users = cachedDb.collection('users');
          const spec = { rutHash: 1 };
          const unique = { name: 'rutHash_unique', unique: true, partialFilterExpression: { rutHash: { $type: 'string', $gt: '' } } };
          try {
            await users.createIndex(spec, unique);
            await users.dropIndex('rutHash_1').catch(() => {});
          } catch (err) {
            if (err?.code === 85 || err?.code === 86) {
              // Mismo patrón de claves con otras opciones: se reemplaza el índice simple por el único
              try { await users.dropIndex('rutHash_1'); await users.createIndex(spec, unique); }
              catch (err2) { await users.createIndex(spec).catch(() => {}); console.warn('No se pudo crear el índice único users.rutHash:', err2.message); }
            } else {
              await users.createIndex(spec).catch(() => {});
              console.warn('No se pudo crear el índice único users.rutHash (¿RUT duplicados?):', err.message);
            }
          }
        })();
        // Un correo = una cuenta (sin distinguir mayúsculas). En la prueba 1 un correo importado desde
        // Pendientes y el mismo correo registrado por el alumno quedaron como dos cuentas distintas.
        cachedDb.collection('users').createIndex(
          { email: 1 },
          { name: 'email_unique', unique: true, collation: { locale: 'es', strength: 2 }, partialFilterExpression: { email: { $gt: '' } } }
        ).catch((err) => console.warn('No se pudo crear el índice único users.email:', err.message));
        // El id de usuario identifica la sesión: nunca puede repetirse (si hay duplicados antiguos, el índice no se crea y se avisa)
        cachedDb.collection('users').createIndex(
          { id: 1 },
          { name: 'id_unique', unique: true, partialFilterExpression: { id: { $type: 'string' } } }
        ).catch((err) => console.warn('No se pudo crear el índice único users.id:', err.message));
        // Índices de seguridad y rendimiento (idempotentes; si fallan solo se avisa)
        const ensure = (collection, spec, options = {}) =>
          cachedDb.collection(collection).createIndex(spec, options).catch((err) =>
            console.warn(`No se pudo crear el índice ${collection}.${options.name || Object.keys(spec).join('_')}:`, err.message));
        // Los enlaces de recuperación vencidos se borran solos (política de conservación)
        ensure('password_resets', { expiresAt: 1 }, { name: 'ttl_expires', expireAfterSeconds: 0 });
        ensure('password_resets', { tokenHash: 1 }, { name: 'token_hash' });
        ensure('sessions', { id: 1 }, { name: 'id_unique', unique: true, partialFilterExpression: { id: { $type: 'string' } } });
        ensure('sessions', { date: 1 }, { name: 'date' });
        ensure('sessions', { studentIds: 1 }, { name: 'student_ids' });
        ensure('sessions', { tutorId: 1 }, { name: 'tutor_id' });
        ensure('notifications', { toEmail: 1 }, { name: 'to_email' });
        ensure('audit_log', { at: -1 }, { name: 'at' });
        ensure('audit_log', { actor: 1, at: -1 }, { name: 'actor_at' });
        ensure('email_queue', { status: 1, runAfter: 1 }, { name: 'status_run_after' });
        console.log("¡Conectado exitosamente a MongoDB Atlas!");
        return cachedDb;
      } catch (error) {
        cachedClient = null;
        cachedDb = null;
        await mongoClient?.close().catch(() => {});
        if (DNS_SYSCALLS.includes(error?.syscall) && uri.startsWith('mongodb+srv://') && !useStandardUri) {
          useStandardUri = true;
          console.warn(`⚠️ Falló la consulta DNS de Atlas (${error.syscall} ${error.code}); reintentando sin registro TXT.`);
          connecting = null;
          return connectDB();
        }
        console.error("Error al conectar a MongoDB Atlas:", error);
        throw error;
      } finally {
        connecting = null;
      }
    })();
  }
  return connecting;
}

export function getDb() {
  return cachedDb;
}

export async function getOrConnectDB() {
  if (cachedDb) return cachedDb;
  return await connectDB();
}

