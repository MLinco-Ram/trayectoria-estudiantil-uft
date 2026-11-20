import bcrypt from 'bcrypt';
import crypto from 'crypto';
import readline from 'readline';
import { connectDB, client } from '../db.js';
import { encryptField, hashRut } from '../services/crypto.service.js';
import { validatePasswordPolicy } from '../services/password.service.js';

// Crea o actualiza la cuenta de Administrador en MongoDB Atlas.
// La contraseña se lee de ADMIN_PASSWORD o se pide por consola; nunca se guarda en el código.
// El correo del administrador se toma de ADMIN_EMAIL (debe ser un correo institucional real: es el que recibe la
// recuperación de contraseña). Una cuenta nueva recibe un id aleatorio; una existente conserva el suyo.
// Uso: ADMIN_EMAIL=nombre@uft.cl npm run create-admin

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl._writeToOutput = (str) => {
      if (str.includes(question)) rl.output.write(str);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function createAdmin() {
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await askHidden('Nueva contraseña de administrador: ');
    const confirm = await askHidden('Repite la contraseña: ');
    if (password !== confirm) {
      console.error('✗ Las contraseñas no coinciden.');
      process.exit(1);
    }
  }

  if (!password || password.length < 12) {
    console.error('✗ La contraseña debe tener al menos 12 caracteres.');
    process.exit(1);
  }
  const policyError = validatePasswordPolicy(password, { rut: 'admin', email: process.env.ADMIN_EMAIL || '', name: 'Administrador' });
  if (policyError) {
    console.error(`✗ ${policyError}`);
    process.exit(1);
  }
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) || adminEmail === 'admin@uft.cl') {
    console.error('✗ Define ADMIN_EMAIL con el correo institucional real del administrador (no admin@uft.cl).');
    process.exit(1);
  }

  try {
    const db = await connectDB();
    const adminRut = 'admin';

    const existing = await db.collection('users').findOne({ rutHash: hashRut(adminRut), roles: 'admin' })
      || await db.collection('users').findOne({ id: 'admin_root' });
    const id = existing?.id || crypto.randomUUID();

    await db.collection('users').updateOne(
      { id },
      {
        $set: {
          id,
          name: 'Administrador del Sistema',
          rut: encryptField(adminRut),
          rutHash: hashRut(adminRut),
          role: 'admin',
          roles: ['admin'],
          email: adminEmail,
          career: 'Administración y Soporte TI',
          password: bcrypt.hashSync(password, 12)
        },
        $inc: { sessionVersion: 1 } // cierra las sesiones abiertas de la cuenta al cambiar la contraseña
      },
      { upsert: true }
    );

    console.log('✓ Cuenta de administrador guardada en MongoDB Atlas (usuario: admin).');
  } catch (err) {
    console.error('✗ Error al crear el administrador:', err.message);
    process.exitCode = 1;
  } finally {
    await client?.close();
  }
}

createAdmin();
