// Interruptores de funcionalidades que pueden activarse sin tocar código.

// Cambio obligatorio de la contraseña inicial (últimos 4 del RUT) en el primer ingreso.
// DESACTIVADO por ahora; para activarlo definir REQUIRE_PASSWORD_CHANGE=true en .env y en Vercel.
export const isPasswordChangeRequired = () => process.env.REQUIRE_PASSWORD_CHANGE === 'true';
