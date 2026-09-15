import { Router } from 'express';
import { sendEmail } from '../services/email.service.js';

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
    console.error("[Mail] Error al enviar correo SMTP:", err);
    res.status(500).json({ error: "Fallo al enviar correo mediante el servidor SMTP", details: err.message });
  }
});

export default router;
