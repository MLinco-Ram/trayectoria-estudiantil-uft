// Validación mínima de entradas (M-04): tipos, largos y campos permitidos. Evita la asignación masiva
// (guardar req.body completo) y los operadores de Mongo disfrazados de datos ({"$ne": ...}).

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Texto con largo máximo; devuelve undefined si no es un texto válido
export const str = (v, max = 200) => (typeof v === 'string' && v.length <= max ? v : undefined);

export const num = (v, { min = -Infinity, max = Infinity } = {}) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);

export const strArray = (v, { maxItems = 200, maxLen = 120 } = {}) =>
  Array.isArray(v) && v.length <= maxItems && v.every(x => typeof x === 'string' && x.length <= maxLen) ? v : undefined;

// Copia solo las claves permitidas, aplicando el validador de cada una. Si un valor no pasa su validador,
// se devuelve { error } con el nombre del campo. Los valores undefined se omiten.
export function pickFields(source, rules) {
  const out = {};
  if (!isPlainObject(source)) return { error: 'Cuerpo de la petición no válido.' };
  for (const [key, check] of Object.entries(rules)) {
    if (source[key] === undefined) continue;
    const value = check(source[key]);
    if (value === undefined) return { error: `El campo "${key}" no es válido.` };
    out[key] = value;
  }
  return { value: out };
}

// Claves de $set permitidas: texto simple, o "campo.<id>" para mapas (attendance.x, ratings.x). Sin operadores.
export const SAFE_KEY = /^[A-Za-z0-9_]{1,40}(\.[A-Za-z0-9_\-]{1,100})?$/;
export const hasSafeKeys = (obj) => isPlainObject(obj) && Object.keys(obj).every(k => SAFE_KEY.test(k));
