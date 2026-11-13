import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { createTransporter } from '../services/email.service.js';
import { hashRut, decryptField, sanitizeUserOutput, normalizeRut } from '../services/crypto.service.js';
import { setSessionCookie, clearSessionCookie } from '../services/session.service.js';
import { sendServerError } from '../utils/errors.js';
import { findUserByEmail } from './users.controller.js';

const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos.';

export const login = async (req, res) => {
  const { rut, password } = req.body;
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
    
    // Compatibilidad con cuentas antiguas sin rutHash (p. ej. las del seed): solo se revisan esas,
    // y al encontrarla se le guarda el rutHash para que la próxima vez use el índice
    if (!user && cleanEnteredRut) {
      const legacyUsers = await db.collection('users').find({ rutHash: { $exists: false } }).toArray();
      user = legacyUsers.find(u => normalizeRut(decryptField(u.rut)) === cleanEnteredRut);
      if (user) {
        await db.collection('users').updateOne({ _id: user._id }, { $set: { rutHash: rutBlindIndex } });
      }
    }

    // Mismo mensaje para RUT inexistente y contraseña incorrecta: no revela qué RUT están registrados
    const isMatch = user?.password ? await bcrypt.compare(password || '', user.password) : false;
    if (!user || !isMatch) {
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    // Las sesiones se identifican por el campo id; se asigna uno a cuentas antiguas que no lo tengan
    if (!user.id) {
      user.id = `user_${user._id.toString()}`;
      await db.collection('users').updateOne({ _id: user._id }, { $set: { id: user.id } });
    }

    setSessionCookie(res, user.id);

    // Retornar usuario con RUT descifrado para el cliente autorizado
    res.json(sanitizeUserOutput(user));
  } catch (err) {
    sendServerError(res, err);
  }
};

export const forgotPassword = async (req, res) => {
  const { identifier, origin } = req.body;
  const db = req.db;
  try {
    if (!identifier || !identifier.trim()) {
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
    } else if (cleanRut) {
      user = await db.collection('users').findOne({
        $or: [
          ...(rutBlindIndex ? [{ rutHash: rutBlindIndex }] : []),
          { rut: cleanRut },
          { rut: rawInput }
        ]
      });
    }

    // 2. Fallback exhaustivo descifrando RUTs si aún no se encontró
    if (!user) {
      const allUsers = await db.collection('users').find({}).toArray();
      user = allUsers.find(u => {
        if (u.email && u.email.trim().toLowerCase() === cleanEmail) return true;
        const plainRut = decryptField(u.rut);
        const normDbRut = normalizeRut(plainRut);
        if (cleanRut && normDbRut && normDbRut === cleanRut) return true;
        return false;
      });
    }

    if (!user) {
      return res.status(404).json({
        error: "No se encontró ningún usuario registrado con el RUT o correo ingresado. Por favor verifica tus datos e intenta nuevamente."
      });
    }

    if (!user.email || !user.email.trim()) {
      return res.status(400).json({
        error: "El usuario encontrado no tiene un correo electrónico institucional asociado para recibir el enlace de recuperación."
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await db.collection('password_resets').deleteMany({ userId: user.id });
    const plainRut = decryptField(user.rut) || user.rut;
    await db.collection('password_resets').insertOne({
      userId: user.id,
      userRut: plainRut,
      token: resetToken,
      expiresAt: expiresAt,
      createdAt: new Date()
    });

    const baseUrl = origin && !origin.includes('localhost') ? origin : (process.env.APP_URL || 'https://trayectoria-estudiantil-uft.vercel.app');
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
          
          <h3 style="color: #092c4c; margin-top: 0;">Hola, ${user.name}</h3>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta institucional en <strong>Trayectoria UFT</strong> asociada al RUT <strong>${plainRut}</strong>.
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

      await transporter.sendMail({
        from: { name: displayName, address: config.user },
        to: `"${user.name}" <${user.email}>`,
        subject: 'Recuperación de Contraseña - Trayectoria UFT',
        text: `Hola ${user.name},\n\nPara restablecer tu contraseña en Trayectoria UFT ingresa al siguiente enlace:\n${resetLink}\n\nVálido por 1 hora.`,
        html: htmlBody
      });
      console.log(`[Forgot-Password] Correo de recuperación enviado a ${user.email}`);
    } else {
      console.warn(`[Forgot-Password] SMTP no configurado. Token generado para prueba: ${resetLink}`);
    }

    res.json({
      success: true,
      message: `Te hemos enviado un correo a ${user.email ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'tu correo'} con el enlace para restablecer tu contraseña. Revisa también tu carpeta de spam.`
    });
  } catch (err) {
    console.error("[Forgot-Password-Error]:", err);
    sendServerError(res, err, "Error al procesar la solicitud de recuperación.");
  }
};

export const verifyResetToken = async (req, res) => {
  const { token } = req.query;
  const db = req.db;
  try {
    if (!token) {
      return res.status(400).json({ valid: false, error: "El enlace de recuperación es inválido o ya ha sido utilizado." });
    }

    const resetRecord = await db.collection('password_resets').findOne({ token: String(token) });
    if (!resetRecord) {
      return res.status(400).json({ valid: false, error: "El enlace de recuperación es inválido o ya ha sido utilizado." });
    }

    if (new Date() > new Date(resetRecord.expiresAt)) {
      await db.collection('password_resets').deleteOne({ token: String(token) });
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
    if (!token) {
      return res.status(400).json({ error: "Token de restablecimiento no proporcionado." });
    }
    if (!newPassword || newPassword.trim().length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    }

    const resetRecord = await db.collection('password_resets').findOne({ token });
    if (!resetRecord) {
      return res.status(400).json({ error: "El enlace de recuperación es inválido o ya ha sido utilizado." });
    }

    if (new Date() > new Date(resetRecord.expiresAt)) {
      await db.collection('password_resets').deleteOne({ token });
      return res.status(400).json({ error: "El enlace de recuperación ha expirado. Por favor solicita uno nuevo." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword.trim(), salt);

    await db.collection('users').updateOne(
      { $or: [{ id: resetRecord.userId }, { rut: resetRecord.userRut }] },
      { $set: { password: hashedPassword }, $unset: { mustChangePassword: '' } }
    );

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
    const isMatch = user?.password ? await bcrypt.compare(String(currentPassword || ''), user.password) : false;
    if (!isMatch) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
    }
    const clean = typeof newPassword === 'string' ? newPassword.trim() : '';
    if (clean.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }
    if (await bcrypt.compare(clean, user.password)) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.' });
    }
    const plainRut = (decryptField(user.rut) || '').replace(/[\.\-\s]/g, '').toUpperCase();
    if (plainRut && plainRut.includes(clean.replace(/[\.\-\s]/g, '').toUpperCase())) {
      return res.status(400).json({ error: 'La nueva contraseña no puede ser parte de tu RUT.' });
    }

    const hashed = await bcrypt.hash(clean, await bcrypt.genSalt(10));
    await req.db.collection('users').updateOne(
      { id: user.id },
      { $set: { password: hashed }, $unset: { mustChangePassword: '' } }
    );
    const { mustChangePassword, ...rest } = user;
    res.json(sanitizeUserOutput({ ...rest, password: hashed }));
  } catch (err) {
    sendServerError(res, err, 'Error al cambiar la contraseña.');
  }
};

export const logout = (req, res) => {
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
