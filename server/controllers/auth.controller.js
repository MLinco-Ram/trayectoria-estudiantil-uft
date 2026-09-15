import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createTransporter } from '../services/email.service.js';
import { hashRut, decryptField, sanitizeUserOutput } from '../services/crypto.service.js';

export const login = async (req, res) => {
  const { rut, password } = req.body;
  const db = req.db;
  try {
    const cleanEnteredRut = (rut || '').replace(/[\.\-]/g, '').trim().toLowerCase();
    
    // Soporte especial para cuenta de Administrador (rut: admin, clave: 1234)
    if (cleanEnteredRut === 'admin' && password === '1234') {
      return res.json({
        id: 'admin_root',
        name: 'Administrador del Sistema',
        rut: 'admin',
        role: 'admin',
        email: 'admin@uft.cl',
        career: 'Administración y Soporte TI'
      });
    }

    const rutBlindIndex = hashRut(cleanEnteredRut);
    
    // Búsqueda eficiente en MongoDB Atlas usando Blind Index (rutHash)
    let user = await db.collection('users').findOne({ rutHash: rutBlindIndex });
    
    // Fallback de compatibilidad retroactiva si aún no tenía hash
    if (!user) {
      const users = await db.collection('users').find({}).toArray();
      user = users.find(u => {
        const decrypted = decryptField(u.rut);
        return (decrypted || '').replace(/[\.\-]/g, '').trim().toLowerCase() === cleanEnteredRut;
      });
    }
    
    if (!user) {
      return res.status(401).json({ error: "RUT no encontrado." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }

    // Retornar usuario con RUT descifrado para el cliente autorizado
    res.json(sanitizeUserOutput(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  const { identifier, origin } = req.body;
  const db = req.db;
  try {
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ error: "Por favor, ingresa tu RUT o correo institucional." });
    }

    const cleanInput = identifier.trim().toLowerCase();
    const rutBlindIndex = hashRut(cleanInput);

    const user = await db.collection('users').findOne({
      $or: [
        { email: cleanInput },
        { rutHash: rutBlindIndex },
        { rut: cleanInput }
      ]
    });

    if (!user) {
      return res.json({
        success: true,
        message: "Si los datos coinciden con una cuenta registrada, se ha enviado un enlace para restablecer la contraseña."
      });
    }

    if (!user.email) {
      return res.status(400).json({ error: "El usuario encontrado no tiene un correo electrónico asociado para enviar el código." });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await db.collection('password_resets').deleteMany({ userId: user.id });
    const plainRut = decryptField(user.rut);
    await db.collection('password_resets').insertOne({
      userId: user.id,
      userRut: plainRut,
      token: resetToken,
      expiresAt: expiresAt,
      createdAt: new Date()
    });

    const baseUrl = origin || 'http://localhost:3000';
    const resetLink = `${baseUrl}?reset_token=${resetToken}`;

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
    res.status(500).json({ error: "Error al procesar la solicitud de recuperación.", details: err.message });
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
    if (!newPassword || newPassword.trim().length < 3) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 3 caracteres." });
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
      { $set: { password: hashedPassword } }
    );

    await db.collection('password_resets').deleteMany({ userId: resetRecord.userId });

    res.json({
      success: true,
      message: "¡Tu contraseña ha sido actualizada exitosamente! Ya puedes iniciar sesión con tu nueva contraseña."
    });
  } catch (err) {
    console.error("[Reset-Password-Error]:", err);
    res.status(500).json({ error: "Error al actualizar la contraseña.", details: err.message });
  }
};
