import { getOrConnectDB } from '../db.js';

// Store de express-rate-limit en MongoDB: en Vercel cada instancia tiene su propia memoria,
// así que el contador debe vivir en la base para que el límite valga para todas.
// Los documentos se borran solos con un índice TTL sobre expiresAt.
const COLLECTION = 'rate_limits';
let indexReady = null;

async function getCollection() {
  const db = await getOrConnectDB();
  const col = db.collection(COLLECTION);
  if (!indexReady) {
    indexReady = col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((err) => {
      indexReady = null;
      console.warn('No se pudo crear el índice TTL de rate_limits:', err.message);
    });
  }
  await indexReady;
  return col;
}

export class MongoRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  key(key) {
    return `${this.prefix}:${key}`;
  }

  async increment(key) {
    const col = await getCollection();
    const id = this.key(key);
    const now = new Date();

    // Ventana vigente: sumar un intento
    const current = await col.findOneAndUpdate(
      { _id: id, expiresAt: { $gt: now } },
      { $inc: { hits: 1 } },
      { returnDocument: 'after' }
    );
    if (current) return { totalHits: current.hits, resetTime: current.expiresAt };

    // Sin ventana o ya vencida: empezar una nueva
    const expiresAt = new Date(now.getTime() + this.windowMs);
    await col.updateOne({ _id: id }, { $set: { hits: 1, expiresAt } }, { upsert: true });
    return { totalHits: 1, resetTime: expiresAt };
  }

  async decrement(key) {
    const col = await getCollection();
    await col.updateOne({ _id: this.key(key), hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    const col = await getCollection();
    await col.deleteOne({ _id: this.key(key) });
  }
}
