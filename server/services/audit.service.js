import { getOrConnectDB } from '../db.js';

// Bitácora de auditoría (M-10): colección de solo inserción con quién hizo qué sobre qué objeto.
// Nunca guarda datos personales (RUT, contraseñas, correos completos), solo ids y el tipo de acción.
export async function audit(req, action, object = {}, meta = {}) {
  try {
    const db = req?.db || await getOrConnectDB();
    await db.collection('audit_log').insertOne({
      at: new Date(),
      actor: req?.user?.id || meta.actor || null,
      actorRoles: req?.userRoles || [],
      ip: req?.ip || null,
      action,
      object,
      meta,
    });
  } catch (err) {
    // La bitácora nunca debe tumbar la operación principal
    console.warn('[Audit] No se pudo registrar el evento:', action, err.message);
  }
}
