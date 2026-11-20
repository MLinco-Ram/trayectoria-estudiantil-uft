import nodemailer from 'nodemailer';
import { getDb, getOrConnectDB } from '../db.js';
import { decryptField } from './crypto.service.js';

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
        pass: decryptField(dbConfig.pass), // se guarda cifrada; las instalaciones antiguas la tienen en claro y también funcionan
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

const escapeText = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const linkify = (escaped) => escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0284c7;word-break:break-all;">$1</a>');

/**
 * Convierte el texto plano de un aviso en HTML ordenado:
 *  - los párrafos (separados por línea en blanco) quedan como párrafos y respetan los saltos de línea;
 *  - los bloques de líneas "Dato: valor" (con o sin viñeta •) se muestran como una tarjeta de datos.
 */
const renderEmailBody = (text) => {
  const FIELD = /^(?:[•\-*]\s*)?([^:\n]{2,48}):\s+(.+)$/;
  return String(text || '').split(/\n{2,}/).map(block => block.trim()).filter(Boolean).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const fields = lines.map(l => l.match(FIELD));
    if (lines.length >= 2 && fields.every(Boolean)) {
      const rows = fields.map(m => `<div style="padding:7px 0;border-bottom:1px solid #e2e8f0;"><div style="margin:0 0 2px;color:#64748b;font-size:11.5px;line-height:1.3;text-transform:uppercase;letter-spacing:0.3px;">${escapeText(m[1])}</div><div style="color:#0f172a;font-size:14px;font-weight:600;line-height:1.45;word-break:break-word;overflow-wrap:anywhere;">${linkify(escapeText(m[2]))}</div></div>`).join('');
      return `<div style="margin:0 0 16px;padding:2px 14px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">${rows}</div>`;
    }
    return `<p style="margin:0 0 14px;color:#475569;font-size:14px;line-height:1.6;word-break:break-word;overflow-wrap:anywhere;">${lines.map(l => linkify(escapeText(l))).join('<br>')}</p>`;
  }).join('\n');
};

// Texto fijo para la vista previa (bandeja, notificación y pantalla de bloqueo): nunca lleva datos del aviso
const PREVIEW_TEXT = 'Tienes una nueva notificación en Trayectoria UFT. Ingresa a la plataforma para ver los detalles.';

/** Quita fechas y horas del asunto, que se ve en notificaciones y en la pantalla de bloqueo. */
export const sanitizeSubject = (subject) => {
  const clean = String(subject || '')
    .replace(/(?:\b(?:el|para el|del|desde el|hasta el)\s+)?(?:\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b)/gi, '')
    .replace(/(?:\b(?:a las|a la|desde las|hasta las|de las)\s+)?\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?\s?m\.?)?/gi, '')
    .replace(/\([\s,\-–·]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,\-–·:]+$/g, '')
    .trim();
  return clean || 'Notificación de Trayectoria UFT';
};

/**
 * Generador de plantilla HTML minimalista institucional
 * Notificación simple con la menor cantidad de información posible y enlace directo a la plataforma
 */
export const formatMinimalEmail = ({
  toName = '',
  subject = 'Notificación de Trayectoria UFT',
  summary = '',
  actionUrl = process.env.APP_URL || 'https://trayectoria-estudiantil-uft.vercel.app',
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

  const greeting = toName ? `Hola, ${escapeText(toName)}` : 'Hola';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeText(sanitizeSubject(subject))}</title>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin: 0; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <!-- Texto de vista previa (bandeja y notificaciones); oculto en el cuerpo -->
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">${escapeText(PREVIEW_TEXT)}&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;&#8204;&nbsp;</div>
  <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
    
    <!-- Header simple institucional -->
    <div style="background-color: #092c4c; padding: 18px 24px; text-align: left;">
      <h1 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 700; letter-spacing: -0.2px;">Trayectoria UFT</h1>
      <span style="display: block; margin-top: 2px; color: #3a9ad9; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Universidad Finis Terrae</span>
    </div>

    <!-- Contenido Minimalista (Saludo Único) -->
    <div style="padding: 20px 18px;">
      <h2 style="margin: 0 0 10px; color: #092c4c; font-size: 15px; font-weight: 700;">${greeting}</h2>
      ${renderEmailBody(cleanSummary)}

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

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Correo con la contraseña temporal: la clave va destacada y la fecha de vencimiento a la vista.
 * Devuelve { subject, text, html } listo para sendEmail.
 */
export const formatInitialPasswordEmail = ({ name = '', email = '', password, expiresAt, hasRut = false, mustChange = true, actionUrl = process.env.APP_URL || 'https://trayectoria-estudiantil-uft.vercel.app' }) => {
  const expires = new Date(expiresAt).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: 'long', year: 'numeric' });
  const loginWith = hasRut ? 'tu RUT o tu correo' : 'tu correo';
  const nextStep = mustChange ? 'Al ingresar por primera vez se te pedirá reemplazarla por una contraseña propia.' : 'Te recomendamos cambiarla después de ingresar.';
  const subject = 'Tu contraseña temporal de Trayectoria Estudiantil UFT';
  const text = `Tu contraseña temporal es: ${password}\n\nEs válida hasta el ${expires} (7 días). Ingresa con ${loginWith} (${email}). ${nextStep}\n\nSi vence antes de que ingreses, usa "¿Olvidaste tu contraseña?" en la pantalla de ingreso para crear una nueva.`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${subject}</title></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f1f5f9;color:#1e293b;">
  <div style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background-color:#092c4c;padding:18px 24px;">
      <h1 style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">Trayectoria UFT</h1>
      <span style="display:block;margin-top:2px;color:#3a9ad9;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Universidad Finis Terrae</span>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 10px;color:#092c4c;font-size:15px;font-weight:700;">Hola${name ? `, ${escapeHtml(name)}` : ''}</h2>
      <p style="margin:0 0 16px;color:#475569;font-size:13.5px;line-height:1.55;">Creamos tu acceso a la plataforma. Esta es tu contraseña temporal:</p>
      <div style="margin:0 0 16px;padding:14px;background-color:#f1f5f9;border:1px dashed #94a3b8;border-radius:10px;text-align:center;font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;letter-spacing:2px;color:#092c4c;">${escapeHtml(password)}</div>
      <div style="margin:0 0 16px;padding:10px 14px;background-color:#fffbeb;border-left:3px solid #f59e0b;border-radius:6px;color:#92400e;font-size:12.5px;line-height:1.5;">
        <strong>Vence el ${escapeHtml(expires)}</strong> (7 días desde hoy). Si no ingresas antes, tendrás que usar "¿Olvidaste tu contraseña?" para crear una nueva.
      </div>
      <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.55;">Ingresa con ${loginWith} (<strong>${escapeHtml(email)}</strong>) y esta contraseña. ${escapeHtml(nextStep)}</p>
      <div style="text-align:center;margin:20px 0 8px;">
        <a href="${escapeHtml(actionUrl)}" target="_blank" style="display:inline-block;background-color:#092c4c;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 24px;border-radius:10px;">Ingresar a la Plataforma &rarr;</a>
      </div>
    </div>
    <div style="background-color:#f8fafc;border-top:1px solid #f1f5f9;padding:12px 24px;text-align:center;">
      <span style="font-size:11px;color:#94a3b8;">Universidad Finis Terrae • Dirección de Trayectoria Estudiantil</span>
    </div>
  </div>
</body>
</html>`;
  return { subject, text, html };
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
  const targetUrl = actionUrl || process.env.APP_URL || 'https://trayectoria-estudiantil-uft.vercel.app';

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
    subject: sanitizeSubject(subject),
    text: `${textGreeting},\n\n${cleanText}\n\nIngresa a la plataforma para ver todos los detalles: ${targetUrl}`,
    html: finalHtml,
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId, senderName: displayName };
};
