import 'dotenv/config';
import { getOrConnectDB, client } from '../db.js';
import { encryptField, decryptField, hashRut, isEncrypted, normalizeRut } from '../services/crypto.service.js';

// Endurecimiento de datos antiguos (informe de seguridad, fases 1 y 2):
//  1. users sin rutHash/RUT cifrado → se cifran e indexan (sin esto, las cuentas antiguas no entran por RUT);
//  2. settings.pass (contraseña SMTP) en claro → se cifra;
//  3. password_resets en formato antiguo (token en claro, con RUT) → se borran (los enlaces pendientes dejan de valer).
// Uso: npx tsx server/scripts/migrate-encrypt-ruts.js [--dry-run]
const DRY = process.argv.includes('--dry-run');

async function migrateUsers() {
  console.log('====================================================');
  console.log('🔒 INICIANDO MIGRACIÓN DE CIFRADO DE RUTS EN MONGODB');
  console.log('====================================================');

  try {
    const db = await getOrConnectDB();
    const usersCollection = db.collection('users');

    const users = await usersCollection.find({}).toArray();
    console.log(`Encontrados ${users.length} usuarios en la colección "users".`);

    let encryptedCount = 0;
    let alreadyEncryptedCount = 0;

    for (const u of users) {
      const rawRut = u.rut || '';
      // Cuentas sin RUT (se identifican por correo): no hay nada que cifrar ni indexar
      if (!rawRut) continue;
      const isAlreadyEnc = isEncrypted(rawRut);
      const computedHash = hashRut(isEncrypted(rawRut) ? decryptField(rawRut) : rawRut);

      if (isAlreadyEnc && u.rutHash) {
        alreadyEncryptedCount++;
        continue;
      }

      // Si no está cifrado o le falta el hash, cifrar y actualizar
      const cipherRut = isAlreadyEnc ? rawRut : encryptField(rawRut);
      
      if (!DRY) await usersCollection.updateOne(
        { _id: u._id },
        {
          $set: {
            rut: cipherRut,
            rutHash: computedHash
          }
        }
      );

      console.log(`[+] Usuario "${u.name}" (ID: ${u.id}) -> RUT cifrado exitosamente en Atlas.`);
      encryptedCount++;
    }

    if (!DRY) await usersCollection.createIndex({ rutHash: 1 });

    // 2. Contraseña SMTP en claro → cifrada
    const smtp = await db.collection('settings').findOne({ type: 'smtp' });
    let smtpEncrypted = 0;
    if (smtp?.pass && !isEncrypted(smtp.pass)) {
      if (!DRY) await db.collection('settings').updateOne({ type: 'smtp' }, { $set: { pass: encryptField(smtp.pass) } });
      smtpEncrypted = 1;
    }

    // 3. Enlaces de recuperación en formato antiguo
    const legacyResets = await db.collection('password_resets').countDocuments({ tokenHash: { $exists: false } });
    if (!DRY && legacyResets > 0) await db.collection('password_resets').deleteMany({ tokenHash: { $exists: false } });

    console.log('====================================================');
    console.log(`${DRY ? '🔎 SIMULACIÓN (no se escribió nada)' : '🎉 MIGRACIÓN COMPLETADA'}:`);
    console.log(`  usuarios con RUT por cifrar/indexar: ${encryptedCount} (ya correctos: ${alreadyEncryptedCount})`);
    console.log(`  contraseña SMTP por cifrar: ${smtpEncrypted}`);
    console.log(`  enlaces de recuperación antiguos por borrar: ${legacyResets}`);
    console.log('====================================================');
    await client?.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error durante la migración:', err);
    process.exit(1);
  }
}

migrateUsers();
