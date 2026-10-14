import bcrypt from 'bcrypt';
import readline from 'readline';
import { connectDB, client } from '../db.js';
import { encryptField, hashRut } from '../services/crypto.service.js';

// Crea o actualiza la cuenta de Administrador en MongoDB Atlas.
// La contraseña se lee de ADMIN_PASSWORD o se pide por consola; nunca se guarda en el código.
// Uso: npm run create-admin

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

  try {
    const db = await connectDB();
    const adminRut = 'admin';

    await db.collection('users').updateOne(
      { id: 'admin_root' },
      {
        $set: {
          id: 'admin_root',
          name: 'Administrador del Sistema',
          rut: encryptField(adminRut),
          rutHash: hashRut(adminRut),
          role: 'admin',
          roles: ['admin'],
          email: 'admin@uft.cl',
          career: 'Administración y Soporte TI',
          password: bcrypt.hashSync(password, 12)
        }
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
