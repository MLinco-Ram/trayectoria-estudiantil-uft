import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dns from 'dns';

// Asegurar resolución de DNS con Google Public DNS para evitar problemas de DNS local/SRV
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore error if setServers fails
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
      const mongoClient = !cachedClient && client && !clientUsed ? client : new MongoClient(uri);
      clientUsed = true;
      try {
        await mongoClient.connect();
        cachedClient = mongoClient;
        cachedDb = mongoClient.db('trayectoria_uft');
        console.log("¡Conectado exitosamente a MongoDB Atlas!");
        return cachedDb;
      } catch (error) {
        cachedClient = null;
        cachedDb = null;
        await mongoClient.close().catch(() => {});
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

