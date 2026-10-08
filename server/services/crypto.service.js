import crypto from 'crypto';

// Clave simétrica de 256 bits (32 bytes) y secreto HMAC
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Recomendado para AES-GCM
const ENCRYPTED_PREFIX = 'enc:';

function getEncryptionKey() {
  const keyHex = process.env.DATA_ENCRYPTION_KEY || 'e4a7b9c1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b';
  return Buffer.from(keyHex, 'hex');
}

function getHmacSecret() {
  return process.env.HMAC_SECRET || '7f8e9d0a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f708192a3b4c5d';
}

/**
 * Normaliza un RUT eliminando puntos, guiones y espacios en minúsculas.
 * Ej: "12.345.678-9" -> "123456789"
 */
export function normalizeRut(rut) {
  if (!rut || typeof rut !== 'string') return '';
  return rut.replace(/[\.\-\s]/g, '').trim().toLowerCase();
}

/**
 * Genera un blind index determinístico HMAC-SHA256 del RUT normalizado.
 * Permite búsquedas indexadas y queries exactas en MongoDB sin descifrar toda la base de datos.
 */
export function hashRut(rut) {
  const normalized = normalizeRut(rut);
  if (!normalized) return '';
  return crypto.createHmac('sha256', getHmacSecret()).update(normalized).digest('hex');
}

/**
 * Determina si un valor ya se encuentra cifrado bajo el esquema estándar enc:iv:tag:cipher
 */
export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Cifra un texto en claro utilizando AES-256-GCM con un IV único de 12 bytes.
 * Retorna formato seguro: "enc:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 */
export function encryptField(plainText) {
  if (!plainText || typeof plainText !== 'string') return plainText;
  if (isEncrypted(plainText)) return plainText; // Ya cifrado

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Desencripta un valor cifrado en formato "enc:<iv_hex>:<tag_hex>:<ciphertext_hex>".
 * Si no está cifrado (registro legado), retorna el valor original de forma segura.
 */
export function decryptField(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;
  if (!isEncrypted(encryptedText)) return encryptedText; // Retorno de compatibilidad retroactiva

  try {
    const raw = encryptedText.slice(ENCRYPTED_PREFIX.length);
    const parts = raw.split(':');
    if (parts.length !== 3) return encryptedText;

    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.warn('[Crypto] Error descifrando campo:', err.message);
    return encryptedText;
  }
}

/**
 * Desencripta el RUT y campos sensibles de un objeto usuario antes de enviarlo al cliente.
 */
export function sanitizeUserOutput(user) {
  if (!user || typeof user !== 'object') return user;
  
  const decryptedRut = decryptField(user.rut);
  const { password, rutHash, ...cleanUser } = user;

  return {
    ...cleanUser,
    rut: decryptedRut || user.rut
  };
}
