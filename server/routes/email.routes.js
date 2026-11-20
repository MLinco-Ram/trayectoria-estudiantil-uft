import { Router } from 'express';
import { sendEmail } from '../services/email.service.js';
import { sendServerError } from '../utils/errors.js';
import { canSendTo, isStaff } from '../middlewares/auth.js';
import { mailLimiter } from '../middlewares/rateLimiters.js';

const router = Router();

const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

router.post('/send-email', mailLimiter, async (req, res) => {
  const { to, toName, subject, text, fromName } = req.body || {};

  // El HTML del correo lo arma siempre el servidor con su plantilla (el cliente solo envía texto);
  // así nadie puede enviar páginas falsas desde la cuenta institucional.
  if (!isText(to, 254) || !isText(subject, 200) || !isText(text, 5000)) {
    return res.status(400).json({ error: "Faltan campos obligatorios o son inválidos (to, subject, text)." });
  }
  if (toName !== undefined && !isText(toName, 120)) {
    return res.status(400).json({ error: 'El nombre del destinatario no es válido.' });
  }

  if (!(await canSendTo(req, to))) {
    return res.status(403).json({ error: 'No puedes enviar correos a ese destinatario.' });
  }

  try {
    const result = await sendEmail({ to: to.trim(), toName, subject, text, fromName: isStaff(req) && isText(fromName, 80) ? fromName : undefined });
    res.json(result);
  } catch (err) {
    sendServerError(res, err, "Fallo al enviar correo mediante el servidor SMTP");
  }
});

export default router;
