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

export const client = new MongoClient(uri);

export async function connectDB() {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    if (!cachedClient) {
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log("¡Conectado exitosamente a MongoDB Atlas!");
    }
    cachedDb = cachedClient.db('trayectoria_uft');
    return cachedDb;
  } catch (error) {
    console.error("Error al conectar a MongoDB Atlas:", error);
    throw error;
  }
}

export function getDb() {
  return cachedDb;
}

export async function getOrConnectDB() {
  if (cachedDb) return cachedDb;
  return await connectDB();
}

