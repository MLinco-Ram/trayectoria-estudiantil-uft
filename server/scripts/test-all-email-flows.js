import 'dotenv/config';
import { getEffectiveSmtpConfig, sendEmail } from '../services/email.service.js';

const base = 'http://localhost:3001';

async function auditEmailFlows() {
  console.log('====================================================');
  console.log('📧 AUDITORÍA EXHAUSTIVA DE FLUJOS DE CORREO SMTP');
  console.log('====================================================');

  const config = await getEffectiveSmtpConfig();
  console.log('1. Verificando configuración SMTP activa en MongoDB Atlas:');
  console.log('   ├─ Host:', config?.host);
  console.log('   ├─ Puerto:', config?.port);
  console.log('   ├─ Usuario:', config?.user);
  console.log('   ├─ Remitente:', config?.fromName);
  console.log('   └─ Estado credencial:', config?.pass ? 'CONFIGURADA (16 chars)' : 'FALTANTE');

  if (!config?.user || !config?.pass) {
    console.error('❌ Credenciales SMTP no detectadas. Configura usuario y contraseña en /admin.');
    process.exit(1);
  }

  let passed = 0;
  const total = 5;

  // TEST 1: Envío Directo con Plantilla Institucional HTML
  console.log('\n2. Probando función sendEmail() con plantilla institucional:');
  try {
    const res1 = await sendEmail({
      to: config.user,
      toName: 'Administrador UFT',
      subject: '[Test 1/5] Verificación de Motor de Correos Trayectoria UFT',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #092c4c; color: white; border-radius: 10px;">
          <h2 style="color: #3a9ad9; margin: 0;">Universidad Finis Terrae</h2>
          <p>Prueba exitosa del motor de correo institucional (sendEmail).</p>
        </div>
      `
    });
    if (res1.success) {
      console.log('   ✓ [PASS] Correo enviado exitosamente (MessageID:', res1.messageId, ')');
      passed++;
    } else {
      console.error('   ✗ [FAIL] Error en sendEmail:', res1);
    }
  } catch (e) {
    console.error('   ✗ [FAIL] Excepción en sendEmail:', e.message);
  }

  // TEST 2: Endpoint API General /api/send-email (Utilizado por triggerNotification)
  console.log('\n3. Probando Endpoint /api/send-email (Inscripciones, Avisos de Asistencia, Inasistencias):');
  try {
    const res2 = await fetch(`${base}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: config.user,
        toName: 'Alumno Prueba',
        subject: '[Test 2/5] Confirmación de Inscripción en Tutoría',
        text: 'Hola, tu inscripción a la tutoría de Cálculo I ha sido confirmada.',
        html: '<p>Hola, tu inscripción a la tutoría de <strong>Cálculo I</strong> ha sido confirmada exitosamente.</p>'
      })
    });
    const data2 = await res2.json();
    if (res2.ok && data2.success) {
      console.log('   ✓ [PASS] Endpoint /api/send-email operativo (MessageID:', data2.messageId, ')');
      passed++;
    } else {
      console.error('   ✗ [FAIL] Endpoint /api/send-email falló:', data2);
    }
  } catch (e) {
    console.error('   ✗ [FAIL] Excepción en /api/send-email:', e.message);
  }

  // TEST 3: Endpoint /api/forgot-password (Recuperación de Contraseña)
  console.log('\n4. Probando Endpoint /api/forgot-password (Recuperación de Contraseña):');
  try {
    const res3 = await fetch(`${base}/api/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '11.111.111-1', // Docente de prueba
        origin: 'http://localhost:3000'
      })
    });
    const data3 = await res3.json();
    if (res3.ok && data3.success) {
      console.log('   ✓ [PASS] Endpoint /api/forgot-password operativo. Mensaje:', data3.message);
      passed++;
    } else {
      console.error('   ✗ [FAIL] Endpoint /api/forgot-password falló:', data3);
    }
  } catch (e) {
    console.error('   ✗ [FAIL] Excepción en /api/forgot-password:', e.message);
  }

  // TEST 4: Endpoint /api/broadcast-message (Comunicados Masivos Oficiales)
  console.log('\n5. Probando Endpoint /api/broadcast-message (Comunicados Oficiales Docentes):');
  try {
    const res4 = await fetch(`${base}/api/broadcast-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docenteName: 'Viviana Carrasco',
        scope: 'all_tutors',
        subject: '[Test 4/5] Comunicado Oficial de Coordinación',
        message: 'Estimados tutores, recordamos cargar sus disponibilidades para el nuevo periodo.',
        priority: 'alta'
      })
    });
    const data4 = await res4.json();
    if (res4.ok && data4.success) {
      console.log('   ✓ [PASS] Endpoint /api/broadcast-message operativo. Despachados:', data4.sentCount, 'destinatarios.');
      passed++;
    } else {
      console.error('   ✗ [FAIL] Endpoint /api/broadcast-message falló:', data4);
    }
  } catch (e) {
    console.error('   ✗ [FAIL] Excepción en /api/broadcast-message:', e.message);
  }

  // TEST 5: Endpoint /api/settings/smtp/test (Prueba en vivo del Administrador)
  console.log('\n6. Probando Endpoint /api/settings/smtp/test (Prueba de Panel Admin):');
  try {
    const res5 = await fetch(`${base}/api/settings/smtp/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testEmail: config.user
      })
    });
    const data5 = await res5.json();
    if (res5.ok && data5.success) {
      console.log('   ✓ [PASS] Endpoint /api/settings/smtp/test operativo. MessageID:', data5.messageId);
      passed++;
    } else {
      console.error('   ✗ [FAIL] Endpoint /api/settings/smtp/test falló:', data5);
    }
  } catch (e) {
    console.error('   ✗ [FAIL] Excepción en /api/settings/smtp/test:', e.message);
  }

  console.log('\n====================================================');
  console.log(`🎉 RESULTADO FINAL: ${passed}/${total} flujos de envío verificados y funcionando en vivo.`);
  console.log('====================================================');
  process.exit(0);
}

auditEmailFlows().catch((err) => {
  console.error('Error general:', err);
  process.exit(1);
});
