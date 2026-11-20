// Validación de RUT chileno: 8 dígitos + dígito verificador (0-9 o K), con módulo 11.
export function isValidRut(input) {
  const clean = String(input ?? '').replace(/[.\-\s]/g, '').toUpperCase();
  if (!/^\d{8}[\dK]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? '0' : rest === 10 ? 'K' : String(rest);
  return dv === expected;
}

export const RUT_ERROR = 'El RUT no es válido. Revisa el número y el dígito verificador (ej: 12.345.678-5).';

// Nombre de persona: texto de 1 a 100 caracteres sin símbolos de marcado
export const isValidName = (v) => typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 100 && !/[<>]/.test(v);
export const NAME_ERROR = 'El nombre no es válido (máximo 100 caracteres y sin los símbolos < >).';
