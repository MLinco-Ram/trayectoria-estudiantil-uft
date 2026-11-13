import { Router } from 'express';
import { sendEmail } from '../services/email.service.js';
import { sendServerError } from '../utils/errors.js';
import { canSendTo, isStaff } from '../middlewares/auth.js';

const router = Router();

router.post('/send-email', async (req, res) => {
  const { to, toName, subject, text, html, fromName } = req.body;

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: "Faltan campos obligatorios (to, subject, text/html)." });
  }

  // Un alumno solo puede escribirse a sí mismo o a coordinación, y sin cambiar el remitente
  if (!(await canSendTo(req, to))) {
    return res.status(403).json({ error: 'No puedes enviar correos a ese destinatario.' });
  }

  try {
    const result = await sendEmail({ to, toName, subject, text, html, fromName: isStaff(req) ? fromName : undefined });
    res.json(result);
  } catch (err) {
    sendServerError(res, err, "Fallo al enviar correo mediante el servidor SMTP");
  }
});

export default router;
