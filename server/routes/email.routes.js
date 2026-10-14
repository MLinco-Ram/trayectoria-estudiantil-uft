import { Router } from 'express';
import { sendEmail } from '../services/email.service.js';
import { sendServerError } from '../utils/errors.js';

const router = Router();

router.post('/send-email', async (req, res) => {
  const { to, toName, subject, text, html, fromName } = req.body;

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: "Faltan campos obligatorios (to, subject, text/html)." });
  }

  try {
    const result = await sendEmail({ to, toName, subject, text, html, fromName });
    res.json(result);
  } catch (err) {
    sendServerError(res, err, "Fallo al enviar correo mediante el servidor SMTP");
  }
});

export default router;
