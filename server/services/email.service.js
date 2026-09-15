import nodemailer from 'nodemailer';
import { getDb, getOrConnectDB } from '../db.js';

/**
 * Obtener configuración SMTP efectiva desde MongoDB con fallback a .env
 */
export const getEffectiveSmtpConfig = async () => {
  try {
    const db = await getOrConnectDB();
    const dbConfig = await db.collection('settings').findOne({ type: 'smtp' });
    if (dbConfig && dbConfig.user && dbConfig.pass) {
      return {
        host: dbConfig.host || 'smtp.gmail.com',
        port: parseInt(dbConfig.port || '465', 10),
        secure: dbConfig.secure !== false,
        user: dbConfig.user,
        pass: dbConfig.pass,
        fromName: dbConfig.fromName || 'Trayectoria Estudiantil UFT'
      };
    }
  } catch (e) {
    console.warn("No se pudo consultar settings en MongoDB:", e.message);
  }

  // Fallback a .env
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE !== 'false',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromName: process.env.SMTP_FROM_NAME || 'Trayectoria Estudiantil UFT'
    };
  }

  return null;
};

/**
 * Instancia un transporte nodemailer con las credenciales activas
 */
export const createTransporter = async () => {
  const config = await getEffectiveSmtpConfig();
  if (!config) return null;

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return { transporter, config };
};

/**
 * Envío genérico de correos electrónicos
 */
export const sendEmail = async ({ to, toName, subject, text, html, fromName: customFromName }) => {
  const client = await createTransporter();
  if (!client) {
    console.warn(`[Mail] Credenciales SMTP no configuradas. Correo simulado para: ${to}`);
    return { simulated: true, message: "Credenciales SMTP no detectadas. Simulado internamente." };
  }

  const { transporter, config } = client;
  const displayName = (customFromName && customFromName.trim()) || (config.fromName && config.fromName.trim()) || 'Trayectoria Estudiantil UFT';

  const mailOptions = {
    from: {
      name: displayName,
      address: config.user,
    },
    headers: {
      'From': `"${displayName}" <${config.user}>`,
      'Sender': config.user,
      'Reply-To': config.user
    },
    to: toName ? `"${toName}" <${to}>` : to,
    subject: subject,
    text: text,
    html: html || text.replace(/\n/g, '<br/>'),
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId, senderName: displayName };
};
