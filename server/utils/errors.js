// Responde un 500 sin exponer detalles internos (Mongo, rutas, pila) al navegador.
// El error completo queda en los logs del servidor; en desarrollo también se devuelve para depurar.
export function sendServerError(res, err, message = 'Error interno del servidor. Intenta de nuevo más tarde.') {
  // Índice único violado (p. ej. dos registros simultáneos con el mismo correo)
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    const label = field === 'email' ? 'El correo' : field === 'rutHash' ? 'El RUT' : 'El dato';
    return res.status(409).json({ error: `${label} ya se encuentra registrado en el sistema.` });
  }
  console.error(`[500] ${res.req?.method} ${res.req?.originalUrl}:`, err);
  const body = { error: message };
  if (process.env.NODE_ENV !== 'production') body.details = err?.message;
  res.status(500).json(body);
}
