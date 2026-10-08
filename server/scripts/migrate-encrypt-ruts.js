import 'dotenv/config';
import { getOrConnectDB } from '../db.js';
import { encryptField, hashRut, isEncrypted, normalizeRut } from '../services/crypto.service.js';

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
      const isAlreadyEnc = isEncrypted(rawRut);
      const computedHash = hashRut(rawRut);

      if (isAlreadyEnc && u.rutHash) {
        alreadyEncryptedCount++;
        continue;
      }

      // Si no está cifrado o le falta el hash, cifrar y actualizar
      const cipherRut = isAlreadyEnc ? rawRut : encryptField(rawRut);
      
      await usersCollection.updateOne(
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

    // Crear índice en rutHash para búsquedas O(1) de alta velocidad
    await usersCollection.createIndex({ rutHash: 1 });
    console.log('✓ Índice creado en "rutHash" para consultas seguras.');

    console.log('====================================================');
    console.log(`🎉 MIGRACIÓN COMPLETADA: ${encryptedCount} actualizados, ${alreadyEncryptedCount} ya cifrados.`);
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error durante la migración:', err);
    process.exit(1);
  }
}

migrateUsers();
