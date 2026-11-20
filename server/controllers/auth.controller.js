import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createTransporter } from '../services/email.service.js';
import { hashRut, decryptField, sanitizeUserOutput, normalizeRut } from '../services/crypto.service.js';
import { setSessionCookie, clearSessionCookie, readSessionCookie, verifySessionToken } from '../services/session.service.js';
import { audit } from '../services/audit.service.js';
import { verifyTotp } from '../services/totp.service.js';
import { sendEmail } from '../services/email.service.js';

// Aviso por correo cuando cambia la contraseña de la cuenta (si no fue la persona, puede reaccionar)
const notifyPasswordChanged = (user) => {
  if (!user?.email) return;
  sendEmail({
    to: user.email, toName: user.name,
    subject: 'Cambió la contraseña de tu cuenta',
    text: 'La contraseña de tu cuenta de Trayectoria UFT fue cambiada y se cerraron tus otras sesiones. Si no fuiste tú, usa "¿Olvidaste tu contraseña?" en la pantalla de ingreso y avisa a la Dirección de Trayectoria Estudiantil.'
  }).catch(err => console.warn("[Mail] No se pudo enviar el aviso de cambio de contraseña:", err.message));
};
import { sendServerError } from '../utils/errors.js';
import { findUserByEmail } from './users.controller.js';
import { validatePasswordPolicy, isInitialPasswordExpired } from '../services/password.service.js';

// Los tokens de recuperación son 32 bytes en hexadecimal; cualquier otra cosa (p. ej. un objeto {$ne: null}) se rechaza
const RESET_TOKEN_FORMAT = /^[a-f0-9]{64}$/;
const INVALID_RESET_LINK = 'El enlace de recuperación es inválido o ya ha sido utilizado.';

// En la base solo se guarda el hash del token: quien lea la colección no puede usar los enlaces vigentes
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DUMMY_HASH = bcrypt.hashSync('contraseña-ficticia-para-igualar-tiempos', 10);

const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos.';

export const login = async (req, res) => {
  const { rut, password, totp } = req.body || {};
  const db = req.db;
  try {
    // El identificador puede ser un RUT o un correo (las cuentas creadas desde Pendientes no tienen RUT)
    const identifier = typeof rut === 'string' ? rut.trim() : '';
    const isEmail = identifier.includes('@');
    const cleanEnteredRut = isEmail ? '' : normalizeRut(identifier);
    const rutBlindIndex = cleanEnteredRut ? hashRut(cleanEnteredRut) : '';

    let user = isEmail
      ? await findUserByEmail(db, identifier)
      // Búsqueda eficiente en MongoDB Atlas usando Blind Index (rutHash)
      : (rutBlindIndex ? await db.collection('users').findOne({ rutHash: rutBlindIndex }) : null);
    
    // Mismo mensaje para RUT inexistente y contraseña incorrecta: no revela qué RUT están registrados
    // Siempre se ejecuta bcrypt (contra un hash ficticio si la cuenta no existe) para que el tiempo de respuesta no revele qué RUT o correos están registrados
    const isMatch = await bcrypt.compare(typeof password === 'string' ? password : '', user?.password || DUMMY_HASH) && Boolean(user?.password);
    if (!user || !isMatch) {
      await audit(req, 'auth.login_failed', { userId: user?.id || null });
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    // La contraseña inicial enviada por correo es temporal. Solo quien la conoce ve este mensaje.
    if (isInitialPasswordExpired(user)) {
      return res.status(401).json({
        error: 'Tu contraseña temporal expiró. Usa "¿Olvidaste tu contraseña?" para crear una nueva.',
        code: 'initial_password_expired'
      });
    }

    // Verificación en dos pasos (cuentas que la activaron): contraseña correcta pero falta o falla el código
    if (user.mfaEnabled) {
      if (typeof totp !== 'string' || !totp.trim()) {
        return res.status(401).json({ error: 'Ingresa el código de tu app autenticadora.', mfaRequired: true });
      }
      const step = verifyTotp(decryptField(user.mfaSecret), totp);
      // Un código solo sirve una vez: se rechaza el mismo paso (o uno anterior) ya usado
      if (step === null || step <= (user.mfaLastStep ?? 0)) {
        await audit(req, 'auth.mfa_failed', { userId: user.id });
        return res.status(401).json({ error: 'El código de verificación no es correcto.', mfaRequired: true });
      }
      await db.collection('users').updateOne({ _id: user._id }, { $set: { mfaLastStep: step } });
    }

    // Las sesiones se identifican por el campo id; se asigna uno a cuentas antiguas que no lo tengan
    if (!user.id) {
      user.id = `user_${user._id.toString()}`;
      await db.collection('users').updateOne({ _id: user._id }, { $set: { id: user.id } });
    }

    setSessionCookie(res, user.id, user.sessionVersion ?? 0);
    await audit(req, 'auth.login', { userId: user.id }, { actor: user.id });

    // Retornar usuario con RUT descifrado para el cliente autorizado
    res.json(sanitizeUserOutput(user));
  } catch (err) {
    sendServerError(res, err);
  }
};

export const forgotPassword = async (req, res) => {
  const { identifier } = req.body;
  const db = req.db;
  try {
    if (typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({ error: "Por favor, ingresa tu RUT o correo institucional." });
    }

    const rawInput = identifier.trim();
    const cleanEmail = rawInput.toLowerCase();
    const cleanRut = normalizeRut(rawInput);
    const rutBlindIndex = cleanRut ? hashRut(cleanRut) : '';

    // 1. Buscar en MongoDB Atlas por email, rutHash o RUT directo
    let user = null;

    if (cleanEmail.includes('@')) {
      const escapedEmail = cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      user = await db.collection('users').findOne({
        email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') }
      });
    } else if (rutBlindIndex) {
      user = await db.collection('users').findOne({ rutHash: rutBlindIndex });
    }

    // Respuesta idéntica exista o no la cuenta: no permite averiguar qué RUT o correos están registrados
    const GENERIC_OK = {
      success: true,
      message: 'Si los datos corresponden a una cuenta con correo registrado, te enviamos un enlace para restablecer tu contraseña. Revisa también tu carpeta de spam.'
    };
    if (!user || !user.email || !user.email.trim()) {
      return res.json(GENERIC_OK);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await db.collection('password_resets').deleteMany({ userId: user.id });
    await db.collection('password_resets').insertOne({
      userId: user.id,
      tokenHash: hashToken(resetToken),
      expiresAt: expiresAt, // índice TTL: los vencidos se borran solos
      createdAt: new Date()
    });
    await audit(req, 'auth.password_reset_requested', { userId: user.id }, { actor: user.id });

    // El enlace NUNCA se arma con un origen enviado por el cliente (permitiría apuntar el correo a un sitio ajeno)
    const baseUrl = process.env.APP_URL || 'https://trayectoria-estudiantil-uft.vercel.app';
    const resetLink = `${baseUrl}/reset-password?reset_token=${resetToken}`;

    const client = await createTransporter();
    if (client) {
      const { transporter, config } = client;
      const displayName = config.fromName || 'Trayectoria Estudiantil UFT';
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="background-color: #092c4c; padding: 18px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <h2 style="color: #ffffff; margin: 0; font-size: 18px;">Universidad Finis Terrae</h2>
            <p style="color: #3a9ad9; margin: 4px 0 0; font-size: 12px; font-weight: bold; text-transform: uppercase;">Restablecimiento de Contraseña</p>
          </div>
          
          <h3 style="color: #092c4c; margin-top: 0;">Hola, ${escapeHtml(user.name)}</h3>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta institucional en <strong>Trayectoria UFT</strong>.
          </p>

          <div style="margin: 28px 0; text-align: center;">
            <a href="${resetLink}" target="_blank" style="background-color: #3a9ad9; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
              Restablecer mi Contraseña
            </a>
          </div>

          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br/>
            <a href="${resetLink}" style="color: #3a9ad9; word-break: break-all;">${resetLink}</a>
          </p>

          <p style="color: #94a3b8; font-size: 11px; margin-top: 25px; border-top: 1px solid #f1f5f9; padding-top: 15px;">
            Este enlace es válido por <strong>60 minutos</strong>. Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura.
          </p>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: { name: displayName, address: config.user },
          to: `"${user.name}" <${user.email}>`,
          subject: 'Recuperación de Contraseña - Trayectoria UFT',
          text: `Hola ${user.name},\n\nPara restablecer tu contraseña en Trayectoria UFT ingresa al siguiente enlace:\n${resetLink}\n\nVálido por 1 hora.`,
          html: htmlBody
        });
        console.log(`[Forgot-Password] Correo de recuperación enviado a ${user.email}`);
      } catch (mailErr) {
        // Se responde igual que si todo hubiera salido bien: un error solo ocurriría con cuentas que existen
        console.error('[Forgot-Password] Falló el envío del correo:', mailErr.message);
      }
    } else {
      console.warn(`[Forgot-Password] SMTP no configurado. Token generado para prueba: ${resetLink}`);
    }

    res.json(GENERIC_OK);
  } catch (err) {
    console.error("[Forgot-Password-Error]:", err);
    sendServerError(res, err, "Error al procesar la solicitud de recuperación.");
  }
};

export const verifyResetToken = async (req, res) => {
  const { token } = req.query;
  const db = req.db;
  try {
    if (typeof token !== 'string' || !RESET_TOKEN_FORMAT.test(token)) {
      return res.status(400).json({ valid: false, error: INVALID_RESET_LINK });
    }

    const resetRecord = await db.collection('password_resets').findOne({ tokenHash: hashToken(token) });
    if (!resetRecord) {
      return res.status(400).json({ valid: false, error: "El enlace de recuperación es inválido o ya ha sido utilizado." });
    }

    if (new Date() > new Date(resetRecord.expiresAt)) {
      await db.collection('password_resets').deleteOne({ _id: resetRecord._id });
      return res.status(400).json({ valid: false, error: "El enlace de recuperación ha expirado. Por favor solicita uno nuevo." });
    }

    res.json({ valid: true });
  } catch (err) {
    console.error("[Verify-Token-Error]:", err);
    res.status(500).json({ valid: false, error: "Error al verificar el enlace de recuperación." });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  const db = req.db;
  try {
    if (typeof token !== 'string' || !RESET_TOKEN_FORMAT.test(token)) {
      return res.status(400).json({ error: INVALID_RESET_LINK });
    }
    if (typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'La nueva contraseña no es válida.' });
    }
    const resetRecord = await db.collection('password_resets').findOne({ tokenHash: hashToken(token) });
    if (!resetRecord) {
      return res.status(400).json({ error: "El enlace de recuperación es inválido o ya ha sido utilizado." });
    }

    if (new Date() > new Date(resetRecord.expiresAt)) {
      await db.collection('password_resets').deleteOne({ _id: resetRecord._id });
      return res.status(400).json({ error: "El enlace de recuperación ha expirado. Por favor solicita uno nuevo." });
    }

    const resetUser = await db.collection('users').findOne({ id: resetRecord.userId });
    const policyError = validatePasswordPolicy(newPassword, {
      rut: resetUser ? (decryptField(resetUser.rut) || '') : '',
      email: resetUser?.email,
      name: resetUser?.name
    });
    if (policyError) return res.status(400).json({ error: policyError });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword.trim(), salt);

    // sessionVersion + 1: cierra todas las sesiones abiertas de la cuenta (M-01)
    await db.collection('users').updateOne(
      { id: resetRecord.userId },
      { $set: { password: hashedPassword }, $inc: { sessionVersion: 1 }, $unset: { mustChangePassword: '', initialPasswordExpiresAt: '' } }
    );
    await audit(req, 'auth.password_reset_done', { userId: resetRecord.userId }, { actor: resetRecord.userId });
    notifyPasswordChanged(resetUser);

    await db.collection('password_resets').deleteMany({ userId: resetRecord.userId });

    res.json({
      success: true,
      message: "¡Tu contraseña ha sido actualizada exitosamente! Ya puedes iniciar sesión con tu nueva contraseña."
    });
  } catch (err) {
    console.error("[Reset-Password-Error]:", err);
    sendServerError(res, err, "Error al actualizar la contraseña.");
  }
};

// Cambio de contraseña del propio usuario (obligatorio en el primer ingreso de cuentas creadas por staff)
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  try {
    const user = req.user;
    const isMatch = typeof currentPassword === 'string' && user?.password ? await bcrypt.compare(currentPassword, user.password) : false;
    if (!isMatch) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
    }
    const clean = typeof newPassword === 'string' ? newPassword.trim() : '';
    const policyError = validatePasswordPolicy(clean, { rut: decryptField(user.rut) || '', email: user.email, name: user.name });
    if (policyError) return res.status(400).json({ error: policyError });
    if (await bcrypt.compare(clean, user.password)) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.' });
    }
    const plainRut = (decryptField(user.rut) || '').replace(/[\.\-\s]/g, '').toUpperCase();
    if (plainRut && plainRut.includes(clean.replace(/[\.\-\s]/g, '').toUpperCase())) {
      return res.status(400).json({ error: 'La nueva contraseña no puede ser parte de tu RUT.' });
    }

    const hashed = await bcrypt.hash(clean, await bcrypt.genSalt(10));
    const nextVersion = (user.sessionVersion ?? 0) + 1;
    await req.db.collection('users').updateOne(
      { id: user.id },
      { $set: { password: hashed, sessionVersion: nextVersion }, $unset: { mustChangePassword: '', initialPasswordExpiresAt: '' } }
    );
    // Las demás sesiones quedan cerradas; esta sigue con la versión nueva
    setSessionCookie(res, user.id, nextVersion);
    await audit(req, 'auth.password_changed', { userId: user.id });
    notifyPasswordChanged(user);
    const { mustChangePassword, initialPasswordExpiresAt, ...rest } = user;
    res.json(sanitizeUserOutput({ ...rest, password: hashed, sessionVersion: nextVersion }));
  } catch (err) {
    sendServerError(res, err, 'Error al cambiar la contraseña.');
  }
};

// Cerrar sesión revoca la cookie en el servidor (sessionVersion + 1), no solo la borra del navegador (M-01)
export const logout = async (req, res) => {
  try {
    const session = verifySessionToken(readSessionCookie(req));
    if (session?.uid) {
      await req.db.collection('users').updateOne({ id: session.uid }, { $inc: { sessionVersion: 1 } });
    }
  } catch (err) {
    console.warn('[Logout] No se pudo revocar la sesión:', err.message);
  }
  clearSessionCookie(res);
  res.json({ success: true });
};

// Marca un tutorial como visto por el usuario de la sesión (persistente entre navegadores y equipos)
const TUTORIAL_KEY = /^[a-z_]{1,20}(:[a-z_]{1,30})?$/;
export const markTutorialSeen = async (req, res) => {
  try {
    const key = String(req.body?.key || '');
    if (!TUTORIAL_KEY.test(key)) {
      return res.status(400).json({ error: 'Identificador de tutorial no válido.' });
    }
    const seen = Array.isArray(req.user.tutorialsSeen) ? req.user.tutorialsSeen : [];
    if (!seen.includes(key)) {
      if (seen.length >= 100) return res.status(400).json({ error: 'Demasiados tutoriales registrados.' });
      await req.db.collection('users').updateOne({ id: req.user.id }, { $addToSet: { tutorialsSeen: key } });
    }
    res.json({ tutorialsSeen: seen.includes(key) ? seen : [...seen, key] });
  } catch (err) {
    sendServerError(res, err);
  }
};

// Devuelve el usuario de la sesión actual (requiere requireAuth)
export const me = (req, res) => {
  res.json(sanitizeUserOutput(req.user));
};
