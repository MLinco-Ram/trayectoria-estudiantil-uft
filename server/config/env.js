// Variables de entorno obligatorias: sin ellas el servidor no puede cifrar, firmar sesiones ni conectarse.
export const REQUIRED_ENV = ['MONGODB_URI', 'SESSION_SECRET', 'DATA_ENCRYPTION_KEY', 'HMAC_SECRET'];

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (configúrala en .env y en Vercel).`);
  return value;
}

// Avisa al arrancar de las variables que faltan, para detectarlo en los logs antes del primer error.
export function checkRequiredEnv() {
  const missing = REQUIRED_ENV.filter(name => !process.env[name]);
  if (missing.length > 0) {
    console.error(`✗ Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
  }
  const key = process.env.DATA_ENCRYPTION_KEY;
  if (key && !/^[0-9a-fA-F]{64}$/.test(key)) {
    console.error('✗ DATA_ENCRYPTION_KEY debe tener 64 caracteres hexadecimales (32 bytes).');
  }
  return missing;
}
