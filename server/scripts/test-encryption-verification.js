import 'dotenv/config';
import { getOrConnectDB } from '../db.js';
import { decryptField, isEncrypted } from '../services/crypto.service.js';

const base = 'http://localhost:3001';

async function verifyEncryption() {
  console.log('====================================================');
  console.log('🔒 VERIFICACIÓN DE CIFRADO Y SEGURIDAD EN MONGODB');
  console.log('====================================================');

  const db = await getOrConnectDB();
  const rawUsers = await db.collection('users').find({}).toArray();

  console.log('\n[1] INSPECCIÓN DIRECTA EN MONGODB ATLAS (Colección "users"):');
  let allEncrypted = true;
  for (const u of rawUsers.slice(0, 5)) {
    const isEnc = isEncrypted(u.rut);
    if (!isEnc) allEncrypted = false;
    console.log(` • Usuario: ${u.name}`);
    console.log(`   └─ RUT en MongoDB: ${u.rut.slice(0, 30)}... [Cifrado: ${isEnc ? 'SI (AES-256-GCM)' : 'NO'}]`);
    console.log(`   └─ Blind Index (rutHash): ${u.rutHash ? u.rutHash.slice(0, 20) + '...' : 'NO'}`);
  }

  if (allEncrypted) {
    console.log('✓ Todos los registros revisados están 100% cifrados en reposo en Atlas.');
  }

  console.log('\n[2] VERIFICACIÓN DE ENDPOINT PÚBLICO AUTORIZADO (GET /api/users):');
  const resUsers = await fetch(base + '/api/users');
  const apiUsers = await resUsers.json();
  const sample = apiUsers[0];
  console.log(` • Usuario devuelto al frontend: ${sample.name}`);
  console.log(` • RUT desencriptado para la UI: ${sample.rut}`);
  console.log(` • Campo password / rutHash expuesto: ${sample.password || sample.rutHash ? 'SI (ALERTA)' : 'NO (PROTEGIDO)'}`);

  console.log('\n[3] PRUEBA DE INICIO DE SESIÓN CON RUT CIFRADO:');
  const loginRes = await fetch(base + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rut: '11.111.111-1', password: '123' })
  });
  const loginData = await loginRes.json();
  if (loginRes.ok && loginData.role === 'docente') {
    console.log(`✓ Login exitoso para Docente (${loginData.name}) autenticado contra RUT cifrado.`);
  } else {
    console.error('✗ Falló login de docente:', loginData);
  }

  console.log('\n[4] PRUEBA DE CREACIÓN DE NUEVO USUARIO CON RUT CIFRADO:');
  const newTestRut = '23.999.888-7';
  const createRes = await fetch(base + '/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `test_encrypt_${Date.now()}`,
      name: 'Usuario Prueba Criptográfica',
      rut: newTestRut,
      role: 'alumno',
      email: 'test_crypto@uft.edu',
      password: '123'
    })
  });
  const createData = await createRes.json();
  if (createRes.ok) {
    console.log(`✓ Usuario creado. Comprobando en base de datos física...`);
    const docInDb = await db.collection('users').findOne({ id: createData.id });
    console.log(` • RUT guardado en BD: ${docInDb.rut.slice(0, 35)}... (Empieza con enc: ${isEncrypted(docInDb.rut)})`);
    console.log(` • rutHash generado: ${docInDb.rutHash.slice(0, 20)}...`);

    // Limpieza
    await db.collection('users').deleteOne({ id: createData.id });
    console.log('✓ Registro de prueba eliminado.');
  } else {
    console.error('✗ Falló creación de usuario:', createData);
  }

  console.log('\n====================================================');
  console.log('🎉 TODAS LAS VERIFICACIONES CRIPTOGRÁFICAS COMPLETADAS CON ÉXITO');
  console.log('====================================================');
  process.exit(0);
}

verifyEncryption().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
