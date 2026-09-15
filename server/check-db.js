import { connectDB, client } from './db.js';

async function checkConnection() {
  console.log("🔍 Verificando conexión con MongoDB Atlas...");
  try {
    const db = await connectDB();
    await db.command({ ping: 1 });
    console.log("✅ Conexión exitosa a MongoDB Atlas (Base de datos: trayectoria_uft)");
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error de conexión a MongoDB Atlas:", error.message);
    await client.close();
    process.exit(1);
  }
}

checkConnection();
