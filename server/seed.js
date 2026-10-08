import { connectDB, client } from './db.js';
import { MOCK_USERS, INITIAL_SESSIONS, DEFAULT_AVAILABILITIES, DEFAULT_STUDENT_REQUESTS } from '../src/data.ts';

import bcrypt from 'bcryptjs';

async function seedDatabase() {
  try {
    console.log("Conectando a MongoDB Atlas para poblar datos...");
    const db = await connectDB();

    // Colección de Usuarios con contraseñas encriptadas
    const hashedUsers = MOCK_USERS.map(u => ({
      ...u,
      password: u.password ? bcrypt.hashSync(u.password, 10) : bcrypt.hashSync('123', 10)
    }));

    const usersCol = db.collection('users');
    await usersCol.deleteMany({});
    await usersCol.insertMany(hashedUsers);
    console.log(`✓ Insertados ${hashedUsers.length} usuarios con contraseñas encriptadas en MongoDB Atlas.`);

    // Colección de Sesiones
    const sessionsCol = db.collection('sessions');
    await sessionsCol.deleteMany({});
    await sessionsCol.insertMany(INITIAL_SESSIONS);
    console.log(`✓ Insertadas ${INITIAL_SESSIONS.length} sesiones en MongoDB Atlas.`);

    // Colección de Disponibilidades
    const availabilitiesCol = db.collection('availabilities');
    await availabilitiesCol.deleteMany({});
    await availabilitiesCol.insertMany(DEFAULT_AVAILABILITIES);
    console.log(`✓ Insertadas ${DEFAULT_AVAILABILITIES.length} disponibilidades en MongoDB Atlas.`);

    // Colección de Solicitudes de Alumnos
    const requestsCol = db.collection('student_requests');
    await requestsCol.deleteMany({});
    await requestsCol.insertMany(DEFAULT_STUDENT_REQUESTS);
    console.log(`✓ Insertadas ${DEFAULT_STUDENT_REQUESTS.length} solicitudes en MongoDB Atlas.`);

    // Reportes iniciales
    const reportsCol = db.collection('reports');
    await reportsCol.deleteMany({});
    const initialReports = [
      {
        id: 'report_1',
        sessionId: 'session_3',
        tutorId: 'tutor_1',
        description: 'Problema de salud, solicito reasignar el tutor Carlos Valenzuela o cambiar la tutoría del 2026-05-26 ya que no podré asistir.',
        requestType: 'reasignar_tutor',
        status: 'pendiente',
        createdAt: '2026-05-26T05:00:00Z'
      }
    ];
    await reportsCol.insertMany(initialReports);
    console.log(`✓ Insertados ${initialReports.length} reportes iniciales.`);

    console.log("¡Sembrado (seed) completado con éxito en MongoDB Atlas!");
  } catch (err) {
    console.error("Error al poblar la base de datos:", err);
  } finally {
    await client.close();
  }
}

seedDatabase();
