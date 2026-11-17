// Interruptores de funcionalidades que pueden activarse sin tocar código.

// Cambio obligatorio de la contraseña inicial (aleatoria, enviada por correo) en el primer ingreso.
// ACTIVO por defecto; para desactivarlo definir REQUIRE_PASSWORD_CHANGE=false en .env y en Vercel.
export const isPasswordChangeRequired = () => process.env.REQUIRE_PASSWORD_CHANGE !== 'false';
