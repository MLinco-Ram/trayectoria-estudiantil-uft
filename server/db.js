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

export const client = uri ? new MongoClient(uri) : null;

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
          ? new MongoClient(await toStandardUri(uri))
          : !cachedClient && client && !clientUsed ? client : new MongoClient(uri);
        clientUsed = true;
        await mongoClient.connect();
        cachedClient = mongoClient;
        cachedDb = mongoClient.db('trayectoria_uft');
        // Índice del login por RUT (idempotente; no bloquea la conexión si falla)
        cachedDb.collection('users').createIndex({ rutHash: 1 }).catch((err) =>
          console.warn('No se pudo crear el índice users.rutHash:', err.message));
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

