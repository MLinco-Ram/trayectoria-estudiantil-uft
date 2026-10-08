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
 * Generador de plantilla HTML minimalista institucional
 * Notificación simple con la menor cantidad de información posible y enlace directo a la plataforma
 */
export const formatMinimalEmail = ({
  toName = '',
  subject = 'Notificación de Trayectoria UFT',
  summary = '',
  actionUrl = process.env.APP_URL || 'http://localhost:3000',
  actionText = 'Ver en la Plataforma'
}) => {
  let cleanSummary = summary ? summary.trim() : 'Tienes una nueva actualización en tu cuenta de Trayectoria UFT.';

  // Eliminar cualquier saludo repetido que ya venga incluido al inicio del texto
  // Ej: "Hola, Kevin Castro", "Hola Kevin Castro,", "¡Hola, Kevin!", "Estimado/a Juan,", etc.
  cleanSummary = cleanSummary
    .replace(/^((?:¡?hola|estimad[oa]\/?a?s?|querid[oa]\/?a?s?)[^,:\n\.\!]*[,:\n\.\!]+\s*)+/i, '')
    .trim();

  if (!cleanSummary) {
    cleanSummary = 'Tienes una nueva actualización en tu cuenta de Trayectoria UFT.';
  }

  const greeting = toName ? `Hola, ${toName}` : 'Hola';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
    
    <!-- Header simple institucional -->
    <div style="background-color: #092c4c; padding: 18px 24px; text-align: left;">
      <h1 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 700; letter-spacing: -0.2px;">Trayectoria UFT</h1>
      <span style="display: block; margin-top: 2px; color: #3a9ad9; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Universidad Finis Terrae</span>
    </div>

    <!-- Contenido Minimalista (Saludo Único) -->
    <div style="padding: 24px;">
      <h2 style="margin: 0 0 10px; color: #092c4c; font-size: 15px; font-weight: 700;">${greeting}</h2>
      <p style="margin: 0 0 20px; color: #475569; font-size: 13.5px; line-height: 1.55;">
        ${cleanSummary}
      </p>

      <!-- Botón directo a la plataforma -->
      <div style="text-align: center; margin: 24px 0 16px;">
        <a href="${actionUrl}" target="_blank" style="display: inline-block; background-color: #092c4c; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 24px; border-radius: 10px; box-shadow: 0 2px 6px rgba(9, 44, 76, 0.25);">
          ${actionText} &rarr;
        </a>
      </div>

      <p style="margin: 16px 0 0; font-size: 11.5px; color: #64748b; line-height: 1.4; text-align: center;">
        Toda la información detallada se encuentra disponible directamente en la plataforma.
      </p>
    </div>

    <!-- Footer minimal -->
    <div style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 12px 24px; text-align: center;">
      <span style="font-size: 11px; color: #94a3b8;">Universidad Finis Terrae • Dirección de Trayectoria Estudiantil</span>
    </div>

  </div>
</body>
</html>`;
};

/**
 * Envío genérico de correos electrónicos simplificados
 */
export const sendEmail = async ({ to, toName, subject, text, html, fromName: customFromName, actionUrl, actionText }) => {
  const client = await createTransporter();
  if (!client) {
    console.warn(`[Mail] Credenciales SMTP no configuradas. Correo simulado para: ${to}`);
    return { simulated: true, message: "Credenciales SMTP no detectadas. Simulado internamente." };
  }

  const { transporter, config } = client;
  const displayName = (customFromName && customFromName.trim()) || (config.fromName && config.fromName.trim()) || 'Trayectoria Estudiantil UFT';
  const targetUrl = actionUrl || process.env.APP_URL || 'http://localhost:3000';

  // Usar plantilla minimalista con link directo
  const rawSummary = text || (html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) : 'Tienes una nueva notificación.');
  const finalHtml = html && html.includes('<!DOCTYPE html>')
    ? html
    : formatMinimalEmail({
        toName,
        subject,
        summary: rawSummary,
        actionUrl: targetUrl,
        actionText: actionText || 'Ver en la Plataforma'
      });

  // Limpiar saludo duplicado también para la versión de texto plano
  const cleanText = rawSummary
    .replace(/^((?:¡?hola|estimad[oa]\/?a?s?|querid[oa]\/?a?s?)[^,:\n\.\!]*[,:\n\.\!]+\s*)+/i, '')
    .trim();
  const textGreeting = toName ? `Hola, ${toName}` : 'Hola';

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
    text: `${textGreeting},\n\n${cleanText}\n\nIngresa a la plataforma para ver todos los detalles: ${targetUrl}`,
    html: finalHtml,
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId, senderName: displayName };
};
