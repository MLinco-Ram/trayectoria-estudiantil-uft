import nodemailer from 'nodemailer';
import { getEffectiveSmtpConfig } from '../services/email.service.js';

export const getSmtpSettings = async (req, res) => {
  const db = req.db;
  try {
    const dbConfig = await db.collection('settings').findOne({ type: 'smtp' });
    if (dbConfig) {
      const { pass, ...safeConfig } = dbConfig;
      return res.json({
        ...safeConfig,
        hasPassword: Boolean(pass),
        configured: Boolean(dbConfig.user && pass)
      });
    }

    res.json({
      type: 'smtp',
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE !== 'false',
      user: process.env.SMTP_USER || '',
      hasPassword: Boolean(process.env.SMTP_PASS),
      fromName: process.env.SMTP_FROM_NAME || 'Trayectoria Estudiantil UFT',
      configured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const saveSmtpSettings = async (req, res) => {
  const db = req.db;
  try {
    const { host, port, secure, user, pass, fromName } = req.body;
    
    if (!user) {
      return res.status(400).json({ error: "El correo de usuario SMTP es requerido." });
    }

    const current = await db.collection('settings').findOne({ type: 'smtp' });
    const finalPass = (pass && pass.trim()) ? pass.trim() : (current?.pass || process.env.SMTP_PASS || '');

    const newConfig = {
      type: 'smtp',
      host: host || 'smtp.gmail.com',
      port: parseInt(port || '465', 10),
      secure: secure !== false,
      user: user.trim(),
      pass: finalPass,
      fromName: fromName || 'Trayectoria Estudiantil UFT',
      updatedAt: new Date().toISOString()
    };

    await db.collection('settings').updateOne(
      { type: 'smtp' },
      { $set: newConfig },
      { upsert: true }
    );

    res.json({ success: true, message: "Configuración SMTP guardada exitosamente en la base de datos." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const testSmtp = async (req, res) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail) {
      return res.status(400).json({ error: "Ingresa un correo de destino para la prueba." });
    }

    const config = await getEffectiveSmtpConfig();
    if (!config) {
      return res.status(400).json({ error: "No hay credenciales SMTP configuradas aún (usuario y contraseña de aplicación)." });
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    await transporter.verify();

    const displayName = (config.fromName && config.fromName.trim()) || 'Trayectoria Estudiantil UFT';

    const info = await transporter.sendMail({
      from: {
        name: displayName,
        address: config.user,
      },
      headers: {
        'From': `"${displayName}" <${config.user}>`,
        'Sender': config.user,
        'Reply-To': config.user
      },
      to: testEmail,
      subject: "Prueba de Servidor de Correos - Trayectoria Estudiantil UFT",
      text: `¡Hola!\n\nEste es un correo de prueba enviado desde el Panel de Administración de Trayectoria Estudiantil UFT.\n\nLa conexión con el servidor SMTP de Google (${config.user}) está funcionando al 100% con el nombre de remitente: "${displayName}".\n\nFecha: ${new Date().toLocaleString('es-CL')}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #092c4c; margin-top: 0;">🚀 Prueba Exitosa de Correo Electrónico</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.5;">
            Este es un correo de prueba enviado desde el <strong>Panel de Administración</strong> de <strong>Trayectoria Estudiantil UFT</strong>.
          </p>
          <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; font-size: 13px; color: #1e293b; margin: 16px 0;">
            <strong>Detalles del Servidor:</strong><br/>
            • Servidor: ${config.host}:${config.port}<br/>
            • Cuenta Remitente: ${config.user}<br/>
            • Nombre Remitente Visible: <strong>${displayName}</strong><br/>
            • Fecha y Hora: ${new Date().toLocaleString('es-CL')}
          </div>
          <p style="color: #16a34a; font-weight: bold; font-size: 13px;">
            ✓ La autenticación con Google SMTP está configurada y lista para notificar a los alumnos.
          </p>
        </div>
      `
    });

    res.json({ success: true, message: `Correo de prueba enviado con éxito a ${testEmail} como "${displayName}"`, messageId: info.messageId });
  } catch (err) {
    console.error("[Mail Test Error]:", err);
    res.status(500).json({ error: "Error en la prueba SMTP", details: err.message });
  }
};
