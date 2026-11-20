// Prueba de carga (informe de seguridad, Fase 3): 300 alumnos virtuales inician sesión, cargan su panel y se
// inscriben en las MISMAS 5 sesiones, para comprobar que los cupos no se superan y que la API aguanta.
//
// IMPORTANTE: ejecutar contra una COPIA de la base y un entorno de pruebas, nunca contra producción.
// Requisitos: k6 (https://k6.io), 300 cuentas de alumno de prueba y 5 sesiones con cupo limitado.
//   BASE_URL=https://staging... SESSION_IDS=s1,s2,s3,s4,s5 USERS_CSV=load/alumnos-prueba.csv k6 run load/k6-inscripcion.js
// USERS_CSV: una línea por alumno "rut,password".
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3001';
const SESSIONS = (__ENV.SESSION_IDS || '').split(',').filter(Boolean);
const users = new SharedArray('alumnos', () => open(__ENV.USERS_CSV || './alumnos-prueba.csv').trim().split('\n').map(l => { const [rut, password] = l.split(','); return { rut, password: (password || '').trim() }; }));

const enrollOk = new Counter('inscripciones_ok');
const enrollFull = new Counter('inscripciones_sin_cupo');
const loginTime = new Trend('login_ms');

export const options = {
  scenarios: { curso: { executor: 'per-vu-iterations', vus: 300, iterations: 1, maxDuration: '5m' } },
  thresholds: {
    http_req_failed: ['rate<0.02'],          // menos de 2 % de errores (los 409 por cupo lleno son esperados y no cuentan como falla)
    http_req_duration: ['p(95)<2500'],       // 95 % de las respuestas bajo 2,5 s
    login_ms: ['p(95)<3000'],
  },
};

export default function () {
  const u = users[(__VU - 1) % users.length];
  const headers = { 'Content-Type': 'application/json' };
  const login = http.post(`${BASE}/api/login`, JSON.stringify({ rut: u.rut, password: u.password }), { headers, responseCallback: http.expectedStatuses(200, 401, 429) });
  loginTime.add(login.timings.duration);
  if (!check(login, { 'login 200': r => r.status === 200 })) return;

  // Panel del alumno: lo que carga la app al entrar
  for (const path of ['/api/me', '/api/sessions', '/api/users', '/api/rooms', '/api/notifications']) {
    check(http.get(`${BASE}${path}`), { [`${path} 200`]: r => r.status === 200 });
  }

  // Todos intentan inscribirse en las mismas sesiones a la vez
  for (const id of SESSIONS) {
    const r = http.post(`${BASE}/api/sessions/${id}/enroll`, null, { headers, responseCallback: http.expectedStatuses(200, 400, 403, 409) });
    if (r.status === 200) enrollOk.add(1);
    if (r.status === 409) enrollFull.add(1);
  }
  sleep(1);
}

// Al terminar, revisar a mano que ninguna sesión tenga más inscritos que su cupo (maxSpots) y que la suma de
// "inscripciones_ok" coincida con los inscritos reales.
