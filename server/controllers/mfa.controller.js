import { encryptField, decryptField } from '../services/crypto.service.js';
import { generateSecret, verifyTotp, otpauthUri } from '../services/totp.service.js';
import { sendServerError } from '../utils/errors.js';
import { audit } from '../services/audit.service.js';

// MFA con app autenticadora (TOTP) para cuentas con privilegios. Flujo: setup (genera un secreto pendiente) →
// enable (el usuario prueba un código y queda activo). Desactivar exige un código vigente; si alguien pierde su
// teléfono, un administrador puede reiniciarlo (DELETE /api/users/:id/mfa).

export const mfaStatus = (req, res) => res.json({ enabled: Boolean(req.user.mfaEnabled) });

export const mfaSetup = async (req, res) => {
  try {
    if (req.user.mfaEnabled) return res.status(400).json({ error: 'La verificación en dos pasos ya está activa.' });
    const secret = generateSecret();
    await req.db.collection('users').updateOne({ id: req.user.id }, { $set: { mfaPendingSecret: encryptField(secret) } });
    res.json({ secret, otpauthUri: otpauthUri(secret, req.user.email || req.user.name || req.user.id) });
  } catch (err) {
    sendServerError(res, err);
  }
};

export const mfaEnable = async (req, res) => {
  try {
    const pending = decryptField(req.user.mfaPendingSecret);
    if (!pending) return res.status(400).json({ error: 'Primero inicia la configuración.' });
    const step = verifyTotp(pending, req.body?.code);
    if (step === null) return res.status(400).json({ error: 'El código no es correcto. Revisa la hora de tu teléfono e inténtalo de nuevo.' });
    await req.db.collection('users').updateOne(
      { id: req.user.id },
      { $set: { mfaEnabled: true, mfaSecret: encryptField(pending), mfaLastStep: step }, $unset: { mfaPendingSecret: '' } }
    );
    await audit(req, 'mfa.enabled', { userId: req.user.id });
    res.json({ enabled: true });
  } catch (err) {
    sendServerError(res, err);
  }
};

export const mfaDisable = async (req, res) => {
  try {
    if (!req.user.mfaEnabled) return res.json({ enabled: false });
    if (verifyTotp(decryptField(req.user.mfaSecret), req.body?.code) === null) {
      return res.status(400).json({ error: 'El código no es correcto.' });
    }
    await req.db.collection('users').updateOne({ id: req.user.id }, { $unset: { mfaEnabled: '', mfaSecret: '', mfaLastStep: '' } });
    await audit(req, 'mfa.disabled', { userId: req.user.id });
    res.json({ enabled: false });
  } catch (err) {
    sendServerError(res, err);
  }
};

// Solo administrador: reinicia el MFA de una cuenta (teléfono perdido)
export const mfaReset = async (req, res) => {
  try {
    const target = await req.db.collection('users').findOne({ id: req.params.id }, { projection: { id: 1 } });
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' });
    await req.db.collection('users').updateOne({ id: target.id }, { $unset: { mfaEnabled: '', mfaSecret: '', mfaPendingSecret: '', mfaLastStep: '' }, $inc: { sessionVersion: 1 } });
    await audit(req, 'mfa.reset', { userId: target.id });
    res.json({ success: true });
  } catch (err) {
    sendServerError(res, err);
  }
};
