// Pruebas de seguridad contra el servidor local (http://localhost:3001) y la base configurada en .env.
// Crea cuentas/sesiones de prueba (ids test_fx_*, SIN correo real, así no sale ningún mensaje) y las borra al terminar.
// Uso: npx tsx server/tests/security.integration.js
import 'dotenv/config';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { connectDB, client } from '../db.js';
import { encryptField, hashRut } from '../services/crypto.service.js';
import { generateSecret, totpAt } from '../services/totp.service.js';

const BASE = process.env.TEST_BASE || 'http://localhost:3001';
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : '  ← ' + extra}`); };

const rnd = () => crypto.randomBytes(4).toString('hex');
const PWD = () => `Tf${rnd()}${rnd()}9z`;
const rut9 = () => '9' + String(crypto.randomInt(0, 1e8)).padStart(8, '0');
// RUT con dígito verificador correcto (módulo 11), para los endpoints que lo validan
const validRut = () => {
  const body = String(crypto.randomInt(10000000, 30000000));
  let sum = 0, f = 2;
  for (let i = body.length - 1; i >= 0; i--) { sum += Number(body[i]) * f; f = f === 7 ? 2 : f + 1; }
  const r = 11 - (sum % 11);
  return body + (r === 11 ? '0' : r === 10 ? 'K' : String(r));
};
// Horario que rodea la hora actual de Chile (la asistencia solo se puede marcar cerca de la clase)
const slotAroundNow = (startOffsetMin = -10, durationMin = 60) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  const now = Number(parts.hour) * 60 + Number(parts.minute);
  const f = (m) => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
  return `${f(now + startOffsetMin)} - ${f(now + startOffsetMin + durationMin)}`;
};
const todayCL = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

class Agent {
  constructor() { this.cookie = ''; }
  async req(method, path, body) {
    const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(this.cookie ? { cookie: this.cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.getSetCookie?.() || [];
    const sess = set.map(c => c.split(';')[0]).find(c => c.startsWith('uft_session='));
    if (sess) this.cookie = sess.endsWith('=') ? '' : sess;
    let json = null; const text = await res.text(); try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
  }
}

const accounts = [];
async function mkUser(db, role, extra = {}) {
  const id = `test_fx_${role}_${rnd()}`;
  const password = PWD();
  const rut = rut9();
  await db.collection('users').insertOne({
    id, name: `Test ${role} ${id.slice(-4)}`, rut: encryptField(rut), rutHash: hashRut(rut),
    role, roles: [role], career: 'Prueba', password: await bcrypt.hash(password, 4), createdAt: new Date().toISOString(), ...extra,
  });
  const a = new Agent();
  accounts.push(id);
  return { id, rut, password, agent: a, role };
}
async function loginAs(u, totp) {
  return u.agent.req('POST', '/api/login', { rut: u.rut, password: u.password, ...(totp ? { totp } : {}) });
}

async function main() {
  const db = await connectDB();
  const health = await fetch(BASE + '/api/me').catch(() => null);
  if (!health) { console.error('El servidor no responde en ' + BASE); process.exit(2); }

  const alumnoA = await mkUser(db, 'alumno');
  const alumnoB = await mkUser(db, 'alumno');
  const alumnoC = await mkUser(db, 'alumno');
  const tutorA = await mkUser(db, 'tutor');
  const tutorB = await mkUser(db, 'tutor');
  const docente = await mkUser(db, 'docente');
  const docente2 = await mkUser(db, 'docente');
  for (const u of [alumnoA, alumnoB, alumnoC, tutorA, tutorB, docente, docente2]) {
    const r = await loginAs(u);
    if (r.status !== 200) throw new Error(`No se pudo iniciar sesión de prueba (${u.id}): ${r.status} ${r.text}`);
  }

  // Sesión de tutorA con alumnoA y alumnoC inscritos, hoy y en horario vigente
  const sessId = `test_fx_session_${rnd()}`;
  await db.collection('sessions').insertOne({
    id: sessId, title: 'Sesión de prueba', date: todayCL(), timeSlot: slotAroundNow(-10, 60), location: 'TEST', tutorId: tutorA.id,
    studentIds: [alumnoA.id, alumnoC.id], attendance: { [alumnoA.id]: 'pendiente', [alumnoC.id]: 'pendiente' }, maxSpots: 10, programType: 'tutorias',
  });
  const sess2Id = `test_fx_session_${rnd()}`;
  await db.collection('sessions').insertOne({
    id: sess2Id, title: 'Sesión ajena', date: todayCL(), timeSlot: slotAroundNow(-10, 60), location: 'TEST', tutorId: tutorB.id,
    studentIds: [alumnoB.id], attendance: { [alumnoB.id]: 'pendiente' }, maxSpots: 10, programType: 'tutorias',
  });

  console.log('\n— C-01 Inyección NoSQL en recuperación —');
  const anon = new Agent();
  for (const [label, token] of [['$ne', { $ne: null }], ['$gt', { $gt: '' }], ['corto', 'abc'], ['número', 123]]) {
    const r = await anon.req('POST', '/api/reset-password', { token, newPassword: 'Abcdef12345' });
    ok(`reset-password rechaza token ${label}`, r.status === 400, `${r.status} ${r.text}`);
  }
  ok('verify-reset-token rechaza token objeto', (await anon.req('GET', '/api/verify-reset-token?token[$ne]=x')).status === 400);

  console.log('\n— A-05 Token de recuperación guardado con hash —');
  const tok = crypto.randomBytes(32).toString('hex');
  const resetUser = await mkUser(db, 'alumno');
  await db.collection('password_resets').insertOne({ userId: resetUser.id, tokenHash: crypto.createHash('sha256').update(tok).digest('hex'), expiresAt: new Date(Date.now() + 3600e3), createdAt: new Date() });
  await loginAs(resetUser);
  const oldCookie = resetUser.agent.cookie;
  ok('verify-reset-token acepta el token válido (por hash)', (await anon.req('GET', `/api/verify-reset-token?token=${tok}`)).json?.valid === true);
  const plainDoc = crypto.randomBytes(32).toString('hex');
  await db.collection('password_resets').insertOne({ userId: resetUser.id, token: plainDoc, expiresAt: new Date(Date.now() + 3600e3) });
  ok('un token guardado en claro (formato antiguo) ya no sirve', (await anon.req('GET', `/api/verify-reset-token?token=${plainDoc}`)).status === 400);
  const newPwd = PWD();
  const rr = await anon.req('POST', '/api/reset-password', { token: tok, newPassword: newPwd });
  ok('reset-password con token válido cambia la contraseña', rr.status === 200, rr.text);
  ok('el token queda usado (no se puede reutilizar)', (await anon.req('POST', '/api/reset-password', { token: tok, newPassword: PWD() })).status === 400);
  const stale = new Agent(); stale.cookie = oldCookie;
  ok('M-01: la sesión abierta antes del restablecimiento queda cerrada', (await stale.req('GET', '/api/me')).status === 401);
  resetUser.password = newPwd;
  ok('se puede entrar con la contraseña nueva', (await loginAs(resetUser)).status === 200);

  console.log('\n— C-02 / A-02 Creación y edición de usuarios —');
  ok('alumno no puede crear usuarios', (await alumnoA.agent.req('POST', '/api/users', { name: 'x', rut: rut9(), role: 'alumno' })).status === 403);
  ok('tutor no puede crear usuarios', (await tutorA.agent.req('POST', '/api/users', { name: 'x', rut: rut9(), role: 'alumno' })).status === 403);
  const adminBefore = await db.collection('users').findOne({ id: 'admin_root' }, { projection: { password: 1, email: 1 } });
  const created = await docente.agent.req('POST', '/api/users', { id: 'admin_root', name: 'Test creado', rut: validRut(), role: 'alumno', roles: ['alumno'], _id: 'x', password: 'hack', rutHash: 'x' });
  ok('docente crea alumno: el servidor ignora el id enviado', created.status === 201 && created.json?.id !== 'admin_root', created.text);
  if (created.json?.id) accounts.push(created.json.id);
  const adminAfter = await db.collection('users').findOne({ id: 'admin_root' }, { projection: { password: 1, email: 1 } });
  ok('admin_root quedó intacto', adminBefore && adminAfter && adminBefore.password === adminAfter.password && adminBefore.email === adminAfter.email);
  ok('el id asignado es un UUID', /^[0-9a-f-]{36}$/.test(created.json?.id || ''), created.json?.id);
  ok('docente no puede crear otro docente', (await docente.agent.req('POST', '/api/users', { name: 'x', rut: rut9(), role: 'docente' })).status === 403);
  ok('docente no puede crear un admin', (await docente.agent.req('POST', '/api/users', { name: 'x', rut: rut9(), roles: ['admin'] })).status === 403);
  ok('rol inventado se rechaza', (await docente.agent.req('POST', '/api/users', { name: 'x', rut: rut9(), role: 'superuser' })).status === 400);
  ok('A-02: docente no puede editar a otro docente', (await docente.agent.req('PUT', `/api/users/${docente2.id}`, { email: 'robado@example.com' })).status === 403);
  ok('A-02: docente no puede borrar a otro docente', (await docente.agent.req('DELETE', `/api/users/${docente2.id}`)).status === 403);
  ok('A-02: docente no puede editar al admin', (await docente.agent.req('PUT', '/api/users/admin_root', { name: 'x' })).status === 403);
  ok('docente SÍ puede editar a un alumno', (await docente.agent.req('PUT', `/api/users/${alumnoB.id}`, { career: 'Carrera editada' })).status === 200);
  ok('docente no puede volverse admin a sí mismo', (await docente.agent.req('PUT', `/api/users/${docente.id}`, { roles: ['admin'] })).status === 403);

  console.log('\n— C-03 Datos por rol en GET /api/users —');
  const au = (await alumnoA.agent.req('GET', '/api/users')).json || [];
  ok('alumno: ningún usuario trae RUT, salvo el propio', au.every(u => u.id === alumnoA.id || !u.rut), JSON.stringify(au.filter(u => u.id !== alumnoA.id && u.rut).map(u => u.id)));
  ok('alumno: no ve a otros alumnos', au.filter(u => (u.roles || [u.role]).includes('alumno') && !(u.roles || []).some(r => ['tutor', 'docente'].includes(r)) && u.id !== alumnoA.id).length === 0);
  ok('alumno: no ve a admin', !au.some(u => (u.roles || [u.role]).includes('admin') && !(u.roles || []).includes('docente')));
  ok('alumno: no ve correos de tutores', au.filter(u => (u.roles || [u.role]).includes('tutor') && !(u.roles || []).includes('docente')).every(u => !u.email));
  const tu = (await tutorA.agent.req('GET', '/api/users')).json || [];
  ok('tutor: nadie trae RUT, salvo él mismo', tu.every(u => u.id === tutorA.id || !u.rut), JSON.stringify(tu.filter(u => u.id !== tutorA.id && u.rut).map(u => u.id)));
  const tutorStudents = tu.filter(u => u.id !== tutorA.id && (u.roles || [u.role]).includes('alumno') && !(u.roles || []).some(r => ['tutor', 'docente', 'admin'].includes(r)));
  ok('tutor: ve solo a los alumnos de su sesión', tutorStudents.map(u => u.id).sort().join() === [alumnoA.id, alumnoC.id].sort().join(), tutorStudents.map(u => u.id).join());
  ok('tutor: no ve al alumno de otro tutor', !tu.some(u => u.id === alumnoB.id));
  ok('tutor: no ve admin', !tu.some(u => u.id === 'admin_root'));
  const du = (await docente.agent.req('GET', '/api/users')).json || [];
  ok('docente: ve a todos con RUT (coordinación)', du.length > 20 && du.some(u => u.rut), `n=${du.length}`);

  console.log('\n— A-01 Correos —');
  ok('send-email sin sesión → 401', (await anon.req('POST', '/api/send-email', { to: 'a@b.cl', subject: 's', text: 't' })).status === 401);
  ok('solo html (sin text) → 400', (await alumnoA.agent.req('POST', '/api/send-email', { to: 'a@b.cl', subject: 's', html: '<b>x</b>' })).status === 400);
  ok('alumno no puede escribir a un tercero → 403', (await alumnoA.agent.req('POST', '/api/send-email', { to: 'tercero@example.com', subject: 's', text: 't' })).status === 403);
  ok('alumno no puede escribir a otro alumno → 403', (await alumnoA.agent.req('POST', '/api/send-email', { to: 'otro@example.com', subject: 's', text: 't' })).status === 403);
  ok('tutor no puede escribir a un tercero → 403', (await tutorA.agent.req('POST', '/api/send-email', { to: 'tercero@example.com', subject: 's', text: 't' })).status === 403);
  ok('texto demasiado largo → 400', (await tutorA.agent.req('POST', '/api/send-email', { to: 'a@b.cl', subject: 's', text: 'x'.repeat(6000) })).status === 400);
  ok('destinatario con operador Mongo → 400', (await tutorA.agent.req('POST', '/api/send-email', { to: { $ne: '' }, subject: 's', text: 't' })).status === 400);
  const { canSendTo } = await import('../middlewares/auth.js');
  const mkReq = (u, roles) => ({ db, user: { id: u.id, email: u.email || '' }, userRoles: roles });
  await db.collection('users').updateOne({ id: alumnoC.id }, { $set: { email: `test_fx_${rnd()}@uft.invalid` } });
  const alumnoCEmail = (await db.collection('users').findOne({ id: alumnoC.id })).email;
  await db.collection('users').updateOne({ id: alumnoB.id }, { $set: { email: `test_fx_${rnd()}@uft.invalid` } });
  const alumnoBEmail = (await db.collection('users').findOne({ id: alumnoB.id })).email;
  ok('canSendTo: tutor SÍ puede escribir a su alumno', await canSendTo(mkReq(tutorA, ['tutor']), alumnoCEmail));
  ok('canSendTo: tutor NO puede escribir al alumno de otro tutor', !(await canSendTo(mkReq(tutorA, ['tutor']), alumnoBEmail)));
  ok('canSendTo: alumno NO puede escribir a otro alumno', !(await canSendTo(mkReq(alumnoA, ['alumno']), alumnoCEmail)));

  console.log('\n— A-03 Edición de sesiones —');
  ok('tutor ajeno no puede editar la sesión → 403', (await tutorB.agent.req('PUT', `/api/sessions/${sessId}`, { syllabus: 'hack' })).status === 403);
  ok('tutor dueño no puede cambiar título/sala → 403', (await tutorA.agent.req('PUT', `/api/sessions/${sessId}`, { title: 'hack', location: 'X' })).status === 403);
  ok('tutor dueño no puede reasignar el tutor → 403', (await tutorA.agent.req('PUT', `/api/sessions/${sessId}`, { tutorId: tutorB.id })).status === 403);
  ok('operadores en las claves se rechazan', (await tutorA.agent.req('PUT', `/api/sessions/${sessId}`, { '$set': { title: 'x' } })).status === 400);
  ok('tutor dueño SÍ puede pasar lista → 200', (await tutorA.agent.req('PUT', `/api/sessions/${sessId}`, { attendance: { [alumnoA.id]: 'presente', [alumnoC.id]: 'pendiente' } })).status === 200);
  ok('tutor dueño SÍ puede editar el temario → 200', (await tutorA.agent.req('PUT', `/api/sessions/${sessId}`, { syllabus: 'Temario de prueba' })).status === 200);
  ok('alumno no puede editar sesiones → 403', (await alumnoA.agent.req('PUT', `/api/sessions/${sessId}`, { syllabus: 'hack' })).status === 403);
  ok('alumno no puede crear sesiones → 403', (await alumnoA.agent.req('POST', '/api/sessions', { title: 'x' })).status === 403);
  ok('M-04: docente no puede crear sesión con claves con operador', (await docente.agent.req('POST', '/api/sessions', { location: 'TEST', '$where': '1' })).status === 400);

  console.log('\n— A-04 QR y PIN dinámicos —');
  ok('alumno no puede pedir el PIN → 403', (await alumnoA.agent.req('GET', `/api/sessions/${sessId}/attendance-pin`)).status === 403);
  ok('tutor ajeno no puede pedir el PIN → 403', (await tutorB.agent.req('GET', `/api/sessions/${sessId}/attendance-pin`)).status === 403);
  const code = await tutorA.agent.req('GET', `/api/sessions/${sessId}/attendance-pin`);
  ok('tutor dueño obtiene PIN, QR y vigencia', code.status === 200 && /^\d{6}$/.test(code.json?.pin) && code.json?.qr?.startsWith(sessId + '~') && code.json?.expiresInMs > 0, code.text);
  ok('alumno sin código → 400', (await alumnoA.agent.req('POST', `/api/sessions/${sessId}/qr-attendance`, {})).status === 400);
  ok('alumno con el id suelto (QR antiguo) → 400', (await alumnoA.agent.req('POST', `/api/sessions/${sessId}/qr-attendance`, { token: sessId })).status === 400);
  const parts = code.json.qr.split('~');
  ok('QR con firma falsa → 400', (await alumnoA.agent.req('POST', `/api/sessions/${sessId}/qr-attendance`, { token: `${parts[0]}~${parts[1]}~AAAAAAAAAAAAAAAA` })).status === 400);
  ok('QR vencido (ventana de hace 5 min) → 400', (await alumnoA.agent.req('POST', `/api/sessions/${sessId}/qr-attendance`, { token: `${parts[0]}~${Number(parts[1]) - 7}~${parts[2]}` })).status === 400);
  ok('QR de otra sesión no sirve en esta → 400', (await alumnoA.agent.req('POST', `/api/sessions/${sess2Id}/qr-attendance`, { token: code.json.qr })).status === 400);
  const good = await alumnoA.agent.req('POST', `/api/sessions/${sessId}/qr-attendance`, { token: code.json.qr });
  ok('alumno inscrito con QR vigente → 200 presente', good.status === 200 && good.json?.success, good.text);
  ok('alumno NO inscrito con QR vigente → 403', (await alumnoB.agent.req('POST', `/api/sessions/${sessId}/qr-attendance`, { token: code.json.qr })).status === 403);
  ok('PIN incorrecto → 404', (await alumnoC.agent.req('POST', '/api/sessions/attendance-pin', { pin: code.json.pin === '000000' ? '111111' : '000000' })).status === 404);
  const viaPin = await alumnoC.agent.req('POST', '/api/sessions/attendance-pin', { pin: code.json.pin });
  ok('alumno inscrito con PIN vigente → 200', viaPin.status === 200 && viaPin.json?.success, viaPin.text);
  ok('alumno de otra sesión con el PIN de esta → 404', (await alumnoB.agent.req('POST', '/api/sessions/attendance-pin', { pin: code.json.pin })).status === 404);
  const { verifyAttendanceQr, matchesAttendancePin } = await import('../controllers/sessions.controller.js');
  ok('verifyAttendanceQr: válido ahora', verifyAttendanceQr(sessId, code.json.qr));
  ok('verifyAttendanceQr: vencido a los 3 minutos', !verifyAttendanceQr(sessId, code.json.qr, Date.now() + 180e3));
  ok('matchesAttendancePin: vencido a los 3 minutos', !matchesAttendancePin(sessId, code.json.pin, Date.now() + 180e3));
  ok('matchesAttendancePin: aún válido a los 40 s', matchesAttendancePin(sessId, code.json.pin, Date.now() + 40e3));
  // SE-14: ventana horaria
  const earlyId = `test_fx_session_${rnd()}`;
  await db.collection('sessions').insertOne({ id: earlyId, title: 'Temprano', date: todayCL(), timeSlot: slotAroundNow(180, 60), location: 'TEST', tutorId: tutorA.id, studentIds: [alumnoA.id], attendance: { [alumnoA.id]: 'pendiente' }, maxSpots: 10 });
  const earlyQr = (await tutorA.agent.req('GET', `/api/sessions/${earlyId}/attendance-pin`)).json?.qr;
  const early = await alumnoA.agent.req('POST', `/api/sessions/${earlyId}/qr-attendance`, { token: earlyQr });
  ok('SE-14: asistencia horas antes de la clase (aunque tenga el QR) → 400', early.status === 400 && /minutos antes/.test(early.text), early.text);
  const lateId = `test_fx_session_${rnd()}`;
  await db.collection('sessions').insertOne({ id: lateId, title: 'Terminada', date: todayCL(), timeSlot: slotAroundNow(-200, 60), location: 'TEST', tutorId: tutorA.id, studentIds: [alumnoA.id], attendance: { [alumnoA.id]: 'pendiente' }, maxSpots: 10 });
  const lateQr = (await tutorA.agent.req('GET', `/api/sessions/${lateId}/attendance-pin`)).json?.qr;
  ok('SE-14: asistencia mucho después del término → 400', (await alumnoA.agent.req('POST', `/api/sessions/${lateId}/qr-attendance`, { token: lateQr })).status === 400);
  const staffEarly = await tutorA.agent.req('POST', `/api/sessions/${earlyId}/qr-attendance`, { studentId: alumnoA.id });
  ok('el tutor sí puede marcar asistencia fuera de la ventana', staffEarly.status === 200, staffEarly.text);

  console.log('\n— M-01 Revocación de sesiones —');
  const s1 = await mkUser(db, 'alumno'); await loginAs(s1); const cookie1 = s1.agent.cookie;
  const dev2 = new Agent(); await dev2.req('POST', '/api/login', { rut: s1.rut, password: s1.password }); const cookie2 = dev2.cookie;
  ok('dos sesiones abiertas funcionan', (await s1.agent.req('GET', '/api/me')).status === 200 && (await dev2.req('GET', '/api/me')).status === 200);
  const newP = PWD();
  const cp = await s1.agent.req('POST', '/api/change-password', { currentPassword: s1.password, newPassword: newP });
  ok('cambiar la contraseña → 200', cp.status === 200, cp.text);
  ok('la sesión desde donde se cambió sigue activa', (await s1.agent.req('GET', '/api/me')).status === 200);
  ok('la otra sesión queda cerrada', (await dev2.req('GET', '/api/me')).status === 401);
  const old = new Agent(); old.cookie = cookie1;
  ok('la cookie anterior al cambio ya no sirve', (await old.req('GET', '/api/me')).status === 401);
  s1.password = newP;
  await s1.agent.req('POST', '/api/logout');
  await loginAs(s1); const keep = s1.agent.cookie;
  await s1.agent.req('POST', '/api/logout');
  const reuse = new Agent(); reuse.cookie = keep;
  ok('logout revoca la cookie en el servidor (no solo la borra)', (await reuse.req('GET', '/api/me')).status === 401);
  const forged = new Agent(); forged.cookie = 'uft_session=' + Buffer.from(JSON.stringify({ uid: 'admin_root', sv: 0, exp: Date.now() + 1e9 })).toString('base64url') + '.firmafalsa';
  ok('cookie falsificada → 401', (await forged.req('GET', '/api/me')).status === 401);

  console.log('\n— MFA (TOTP) —');
  const m = await mkUser(db, 'docente'); await loginAs(m);
  ok('MFA inicia desactivado', (await m.agent.req('GET', '/api/mfa')).json?.enabled === false);
  const setup = await m.agent.req('POST', '/api/mfa/setup');
  ok('setup entrega secreto y URI otpauth', setup.status === 200 && /^[A-Z2-7]{32}$/.test(setup.json?.secret) && setup.json?.otpauthUri?.startsWith('otpauth://totp/'), setup.text);
  ok('activar con código incorrecto → 400', (await m.agent.req('POST', '/api/mfa/enable', { code: '000000' })).status === 400);
  const step = () => Math.floor(Date.now() / 30000);
  const en = await m.agent.req('POST', '/api/mfa/enable', { code: totpAt(setup.json.secret, step()) });
  ok('activar con código correcto → 200', en.status === 200 && en.json?.enabled, en.text);
  const noCode = await new Agent().req('POST', '/api/login', { rut: m.rut, password: m.password });
  ok('login sin código → 401 mfaRequired', noCode.status === 401 && noCode.json?.mfaRequired === true, noCode.text);
  const badCode = await new Agent().req('POST', '/api/login', { rut: m.rut, password: m.password, totp: '123456' });
  ok('login con código incorrecto → 401', badCode.status === 401, badCode.text);
  const agentM = new Agent();
  const goodCode = totpAt(setup.json.secret, step() + 1); // paso siguiente: mayor que el usado al activar
  const li = await agentM.req('POST', '/api/login', { rut: m.rut, password: m.password, totp: goodCode });
  ok('login con código correcto → 200', li.status === 200, li.text);
  const replay = await new Agent().req('POST', '/api/login', { rut: m.rut, password: m.password, totp: goodCode });
  ok('el mismo código no sirve dos veces (replay) → 401', replay.status === 401, replay.text);
  ok('la respuesta de /me no expone secretos MFA', !/mfaSecret|mfaPendingSecret|mfaLastStep|sessionVersion/.test(JSON.stringify((await agentM.req('GET', '/api/me')).json)));
  const secretStored = (await db.collection('users').findOne({ id: m.id })).mfaSecret;
  ok('el secreto TOTP se guarda cifrado', typeof secretStored === 'string' && secretStored.startsWith('enc:'));
  ok('un docente no puede reiniciar el MFA de otro', (await docente.agent.req('DELETE', `/api/users/${m.id}/mfa`)).status === 403);

  console.log('\n— Informe de pruebas por módulo: registro y usuarios —');
  const regBase = { career: 'x', email: `test_fx_${rnd()}@uft.cl`, password: PWD() };
  ok('RG-05: RUT con dígito verificador incorrecto → 400', (await anon.req('POST', '/api/register', { ...regBase, name: 'Prueba', rut: '12345678-0' })).status === 400);
  ok('RG-06: RUT de letras → 400', (await anon.req('POST', '/api/register', { ...regBase, name: 'Prueba', rut: 'ABCDEFGHI' })).status === 400);
  ok('RG-07: nombre de 200.000 caracteres → 400', (await anon.req('POST', '/api/register', { ...regBase, name: 'A'.repeat(200000), rut: validRut() })).status === 400);
  ok('RG-08: nombre con < > → 400', (await anon.req('POST', '/api/register', { ...regBase, name: '<img src=x onerror=alert(1)>', rut: validRut() })).status === 400);
  const { isValidRut } = await import('../utils/rut.js');
  ok('isValidRut acepta RUT reales y rechaza los incorrectos', isValidRut('11.111.111-1') && isValidRut('12.345.678-5') && isValidRut('22222222-2') && !isValidRut('12.345.678-0') && !isValidRut('ABCDEFGHI'));
  const { validatePasswordPolicy } = await import('../services/password.service.js');
  for (const bad of ['aaaaaaaa1', 'abababab1', 'abcdefgh1', '12345678', 'password1']) ok(`AU-13: política rechaza "${bad}"`, validatePasswordPolicy(bad) !== null);
  ok('AU-13: política acepta una contraseña razonable', validatePasswordPolicy('Mesa-Verde-4821') === null);
  ok('AU-07: contraseña objeto en el login → 401 (no 500)', (await anon.req('POST', '/api/login', { rut: alumnoA.rut, password: { $ne: 1 } })).status === 401);
  ok('AU-07: contraseña actual objeto al cambiar → 400', (await alumnoA.agent.req('POST', '/api/change-password', { currentPassword: { a: 1 }, newPassword: PWD() })).status === 400);
  ok('US-07: docente no puede fijar la contraseña de otra persona → 403', (await docente.agent.req('PUT', `/api/users/${tutorA.id}`, { password: PWD() })).status === 403);
  ok('US-08: correo numérico al editar → 400 (no 500)', (await docente.agent.req('PUT', `/api/users/${alumnoB.id}`, { email: 12345 })).status === 400);
  ok('US-08: nombre numérico al editar → 400', (await docente.agent.req('PUT', `/api/users/${alumnoB.id}`, { name: 123 })).status === 400);
  const extra = await docente.agent.req('POST', '/api/users', { name: 'Test creado', rut: validRut(), role: 'alumno', saldo: 99, isVerified: true });
  if (extra.json?.id) accounts.push(extra.json.id);
  const extraDoc = extra.json?.id ? await db.collection('users').findOne({ id: extra.json.id }) : null;
  ok('US-10: campos inventados (saldo, isVerified) no se guardan', extra.status === 201 && extraDoc && extraDoc.saldo === undefined && extraDoc.isVerified === undefined, extra.text);
  const dupRut = validRut();
  const d1 = await docente.agent.req('POST', '/api/users', { name: 'Test creado', rut: dupRut, role: 'alumno' });
  const d2 = await docente.agent.req('POST', '/api/users', { name: 'Test creado', rut: dupRut, role: 'alumno' });
  if (d1.json?.id) accounts.push(d1.json.id);
  ok('RG-11: el mismo RUT dos veces → la segunda se rechaza', d1.status === 201 && d2.status >= 400, `${d1.status}/${d2.status}`);
  const sameRut = validRut();
  const race = await Promise.all(Array.from({ length: 6 }, () => docente.agent.req('POST', '/api/users', { name: 'Test creado', rut: sameRut, role: 'alumno' })));
  race.forEach(r => r.json?.id && accounts.push(r.json.id));
  const rutCount = await db.collection('users').countDocuments({ rutHash: hashRut(sameRut) });
  ok('RG-11: 6 altas simultáneas con el mismo RUT → una sola cuenta', rutCount === 1, `creadas=${race.filter(r => r.status === 201).length} en BD=${rutCount}`);
  const idx = await db.collection('users').indexes();
  ok('índice único de rutHash presente', idx.some(i => i.key?.rutHash === 1 && i.unique), JSON.stringify(idx.filter(i => i.key?.rutHash).map(i => ({ n: i.name, u: !!i.unique }))));

  console.log('\n— Informe de pruebas por módulo: sesiones —');
  await db.collection('rooms').updateOne({ code: 'TEST' }, { $setOnInsert: { id: `test_fx_room_${rnd()}`, code: 'TEST' } }, { upsert: true });
  const futureDay = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const mk = (extra2 = {}) => ({ title: 'Sesión creada', date: futureDay, timeSlot: '15:00 - 16:00', location: 'TEST', maxSpots: 5, ...extra2 });
  const c1 = await docente.agent.req('POST', '/api/sessions', mk({ id: sessId }));
  ok('SE-03: crear sesión con un id ya existente → el servidor asigna otro', c1.status === 201 && c1.json?.id !== sessId, c1.text);
  if (c1.json?.id) await db.collection('sessions').updateOne({ id: c1.json.id }, { $set: { id: `test_fx_session_${rnd()}` } });
  ok('SE-04: fecha "mañana" → 400', (await docente.agent.req('POST', '/api/sessions', mk({ date: 'mañana' }))).status === 400);
  ok('SE-04: fecha imposible 2026-02-30 → 400', (await docente.agent.req('POST', '/api/sessions', mk({ date: '2026-02-30' }))).status === 400);
  ok('SE-04: horario "cuando sea" → 400', (await docente.agent.req('POST', '/api/sessions', mk({ timeSlot: 'cuando sea' }))).status === 400);
  ok('SE-04: cupo -5 → 400', (await docente.agent.req('POST', '/api/sessions', mk({ maxSpots: -5 }))).status === 400);
  ok('SE-04: cupo texto → 400', (await docente.agent.req('POST', '/api/sessions', mk({ maxSpots: 'muchos' }))).status === 400);
  ok('SE-04: editar con fecha inválida → 400', (await docente.agent.req('PUT', `/api/sessions/${sessId}`, { date: '2020-13-45' })).status === 400);
  ok('SE-11: encuesta con nota 99999 → 400', (await alumnoA.agent.req('PUT', `/api/sessions/${sessId}`, { [`ratings.${alumnoA.id}`]: { rating: 99999, comment: 'x' } })).status === 400);
  ok('SE-11: comentario de 300.000 caracteres → 400/413', [400, 413].includes((await alumnoA.agent.req('PUT', `/api/sessions/${sessId}`, { [`ratings.${alumnoA.id}`]: { rating: 4, comment: 'x'.repeat(300000) } })).status));
  const goodRating = await alumnoA.agent.req('PUT', `/api/sessions/${sessId}`, { [`ratings.${alumnoA.id}`]: { rating: 4.5, comment: 'Muy buena', answers: { 1: 5, 2: 4 }, studentId: 'otro', hack: 'x' } });
  const ratedDoc = await db.collection('sessions').findOne({ id: sessId });
  ok('SE-11: encuesta válida se guarda solo con campos permitidos', goodRating.status === 200 && ratedDoc.ratings?.[alumnoA.id]?.rating === 4.5 && ratedDoc.ratings[alumnoA.id].studentId === alumnoA.id && ratedDoc.ratings[alumnoA.id].hack === undefined, goodRating.text);
  const privId = `test_fx_session_${rnd()}`;
  await db.collection('sessions').insertOne({ id: privId, title: 'Uno a uno', date: futureDay, timeSlot: '17:00 - 18:00', location: 'TEST', tutorId: tutorB.id, studentIds: [], reservedForStudentId: alumnoB.id, maxSpots: 1, type: 'tutoria_personalizada' });
  const seen = ((await alumnoA.agent.req('GET', '/api/sessions')).json || []).find(x => x.id === privId);
  ok('SE-20: un alumno no ve para quién está reservada una tutoría 1 a 1', seen && seen.reservedForStudentId !== alumnoB.id, JSON.stringify(seen?.reservedForStudentId));
  const oldId = `test_fx_session_${rnd()}`;
  await db.collection('sessions').insertOne({ id: oldId, title: 'Antigua', date: '2020-01-15', timeSlot: '10:00 - 11:00', location: 'TEST', tutorId: tutorB.id, studentIds: [alumnoA.id], attendance: { [alumnoA.id]: 'presente' }, maxSpots: 5, isCompleted: true });
  ok('LO-02: el alumno inscrito sigue viendo su historial antiguo', ((await alumnoA.agent.req('GET', '/api/sessions')).json || []).some(x => x.id === oldId));
  ok('LO-02: otro alumno no recibe sesiones antiguas ajenas', !((await alumnoB.agent.req('GET', '/api/sessions')).json || []).some(x => x.id === oldId));
  ok('LO-02: coordinación recibe todo el historial', ((await docente.agent.req('GET', '/api/sessions')).json || []).some(x => x.id === oldId));
  const raceStudent = await mkUser(db, 'alumno'); await loginAs(raceStudent);
  const raceIds = [];
  for (let i = 0; i < 8; i++) {
    const id = `test_fx_session_${rnd()}`; raceIds.push(id);
    await db.collection('sessions').insertOne({ id, title: `Carrera ${i}`, date: futureDay, timeSlot: `${8 + i}:00 - ${8 + i}:50`, location: 'TEST', tutorId: tutorB.id, studentIds: [], maxSpots: 10, programType: 'tutorias' });
  }
  const enrolls = await Promise.all(raceIds.map(id => raceStudent.agent.req('POST', `/api/sessions/${id}/enroll`)));
  const enrolled = await db.collection('sessions').countDocuments({ id: { $in: raceIds }, studentIds: raceStudent.id });
  ok('SE-07: 8 reservas en paralelo → nunca más de 5 quedan activas', enrolled <= 5, `quedaron ${enrolled} (aceptadas ${enrolls.filter(r => r.status === 200).length})`);
  for (const id of raceIds) await raceStudent.agent.req('POST', `/api/sessions/${id}/enroll`);
  const enrolled2 = await db.collection('sessions').countDocuments({ id: { $in: raceIds }, studentIds: raceStudent.id });
  ok('SE-07: en secuencia el tope sigue en 5', enrolled2 <= 5 && enrolled2 >= 1, `quedaron ${enrolled2}`);

  console.log('\n— Informe de pruebas por módulo: notificaciones, reportes y disponibilidad —');
  const docEmail = `test_fx_${rnd()}@uft.invalid`;
  await db.collection('users').updateOne({ id: docente.id }, { $set: { email: docEmail } });
  const nBody = { id: 'id_fijo_por_el_cliente', toEmail: docEmail, toName: 'x', subject: 'Aviso', message: 'hola', timestamp: '2099-01-01T00:00:00Z', priority: 'urgente', read: true };
  const n1 = await alumnoA.agent.req('POST', '/api/notifications', nBody);
  const n2 = await alumnoA.agent.req('POST', '/api/notifications', nBody);
  ok('NO-03: el id y la fecha los fija el servidor', n1.status === 201 && n1.json?.id !== 'id_fijo_por_el_cliente' && n1.json?.timestamp !== '2099-01-01T00:00:00Z' && n1.json?.id !== n2.json?.id, n1.text);
  ok('NO-03: un alumno no puede marcar prioridad urgente ni "leído"', n1.json?.priority === 'normal' && n1.json?.read === false);
  ok('NO-04: tutor no puede crear avisos a correos externos → 403', (await tutorA.agent.req('POST', '/api/notifications', { toEmail: 'externo@gmail.com', subject: 'x', message: 'y' })).status === 403);
  await db.collection('notifications').deleteMany({ toEmail: docEmail });
  const rep = await tutorA.agent.req('POST', '/api/reports', { sessionId: sessId, description: 'Problema de salud del alumno X', requestType: 'otro' });
  const repDoc = await db.collection('reports').findOne({ id: rep.json?.id });
  ok('RE: el reporte se guarda con la descripción cifrada', rep.status === 201 && repDoc?.description?.startsWith('enc:'), rep.text);
  const mine = ((await tutorA.agent.req('GET', '/api/reports')).json || []).find(r => r.id === rep.json?.id);
  ok('RE: el autor lo lee descifrado', mine?.description === 'Problema de salud del alumno X');
  ok('RE-03: otro tutor no ve el reporte', !((await tutorB.agent.req('GET', '/api/reports')).json || []).some(r => r.id === rep.json?.id));
  ok('RE: coordinación sí lo ve (descifrado)', ((await docente.agent.req('GET', '/api/reports')).json || []).some(r => r.id === rep.json?.id && r.description === 'Problema de salud del alumno X'));
  await db.collection('reports').deleteMany({ tutorId: { $regex: '^test_fx_' } });
  await db.collection('availabilities').insertOne({ userId: alumnoA.id, role: 'alumno', userName: 'x', career: 'x', days: [{ day: 'Lunes', slots: ['09:00 - 10:30'] }] });
  await db.collection('availabilities').insertOne({ userId: tutorB.id, role: 'tutor', userName: 'x', career: 'x', days: [{ day: 'Lunes', slots: ['09:00 - 10:30'] }] });
  const avail = (await tutorA.agent.req('GET', '/api/availabilities')).json || [];
  ok('DI-02: el tutor no ve la disponibilidad de alumnos', !avail.some(a => a.userId === alumnoA.id));
  ok('DI-02: el tutor sí ve la de otros tutores', avail.some(a => a.userId === tutorB.id));
  ok('DI: bloque horario mal formado → 400', (await alumnoA.agent.req('POST', '/api/availabilities', { days: [{ day: 'Lunes', slots: ['cuando sea'] }] })).status === 400);
  await db.collection('availabilities').deleteMany({ userId: { $regex: '^test_fx_' } });

  console.log('\n— NO-07 Sockets: avisos solo para su destinatario —');
  try {
    const { io } = await import('socket.io-client');
    const connect = (u) => new Promise((resolve) => {
      const sock = io(BASE, { transports: ['websocket'], extraHeaders: { cookie: u.agent.cookie }, reconnection: false });
      sock.received = [];
      sock.onAny((ev, payload) => sock.received.push({ ev, payload }));
      sock.on('connect', () => resolve(sock));
      sock.on('connect_error', () => resolve(null));
      setTimeout(() => resolve(null), 4000);
    });
    const [sA, sB, sD] = await Promise.all([connect(alumnoA), connect(alumnoB), connect(docente)]);
    ok('los tres clientes con sesión se conectan', sA && sB && sD);
    const noSession = await new Promise((resolve) => { const sk = io(BASE, { transports: ['websocket'], reconnection: false }); sk.on('connect', () => resolve(true)); sk.on('connect_error', () => resolve(false)); setTimeout(() => resolve(false), 3000); });
    ok('NO-06: conexión sin sesión rechazada', noSession === false);
    await alumnoC.agent.req('POST', '/api/notifications', { toEmail: docEmail, subject: 'Aviso privado', message: 'hola' });
    await new Promise(r => setTimeout(r, 1200));
    const leaks = [sA, sB].flatMap(sk => (sk?.received || []).filter(m => JSON.stringify(m.payload || {}).includes('@')));
    ok('NO-07: ningún alumno recibe el correo del destinatario', leaks.length === 0, JSON.stringify(leaks));
    ok('NO-07: el destinatario sí recibe el evento', (sD?.received || []).some(m => m.ev === 'notifications:changed'));
    ok('NO-07: otros alumnos conectados no reciben el evento dirigido a otra persona', !(sA?.received || []).some(m => m.ev === 'notifications:changed') && !(sB?.received || []).some(m => m.ev === 'notifications:changed'));
    [sA, sB, sD].forEach(sk => sk?.close());
    await db.collection('notifications').deleteMany({ toEmail: docEmail });
  } catch (e) { ok('prueba de sockets', false, e.message); }

  console.log('\n— Administración y robustez —');
  const adminT = await mkUser(db, 'admin'); await loginAs(adminT);
  ok('AD-08: vaciado sin confirmación → 400', (await adminT.agent.req('POST', '/api/system/reset-academic-data', { targetCollections: ['reports'] })).status === 400);
  const before = await db.collection('rate_limits').estimatedDocumentCount();
  ok('AD-08: colección arbitraria (rate_limits) → 400', (await adminT.agent.req('POST', '/api/system/reset-academic-data', { targetCollections: ['rate_limits'], confirm: 'VACIAR' })).status === 400);
  ok('AD-08: colección protegida (password_resets/settings/audit_log) → 400', (await adminT.agent.req('POST', '/api/system/reset-academic-data', { targetCollections: ['password_resets', 'settings', 'audit_log'], confirm: 'VACIAR' })).status === 400);
  ok('AD-08: no se borró nada de rate_limits', (await db.collection('rate_limits').estimatedDocumentCount()) >= before - 5);
  ok('AD-08: docente no puede vaciar → 403', (await docente.agent.req('POST', '/api/system/reset-academic-data', { confirm: 'VACIAR' })).status === 403);
  const al = await adminT.agent.req('GET', '/api/system/audit-log?limit=5');
  ok('bitácora visible para el admin (paginada)', al.status === 200 && Array.isArray(al.json?.items) && al.json.items.length > 0 && al.json.items.length <= 5, al.text.slice(0, 150));
  ok('bitácora no visible para docentes → 403', (await docente.agent.req('GET', '/api/system/audit-log')).status === 403);
  const malformed = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"rut": ' });
  const mtxt = await malformed.text();
  ok('RB-01: JSON malformado → 400 en JSON sin trazas', malformed.status === 400 && mtxt.startsWith('{') && !/at |node_modules|\.js/.test(mtxt), `${malformed.status} ${mtxt.slice(0, 120)}`);
  const nf = await fetch(BASE + '/api/no-existe-esta-ruta');
  const nftxt = await nf.text();
  ok('RB-03: ruta inexistente sin sesión → JSON (401)', nf.status === 401 && nftxt.startsWith('{'), `${nf.status} ${nftxt.slice(0, 80)}`);
  const nf2 = await adminT.agent.req('GET', '/api/no-existe-esta-ruta');
  ok('RB-03: ruta inexistente con sesión → 404 en JSON', nf2.status === 404 && nf2.json?.error, `${nf2.status} ${nf2.text.slice(0, 80)}`);
  const big = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rut: 'x'.repeat(1300000) }) });
  ok('RB-02: cuerpo de 1,3 MB → 413 en JSON', big.status === 413 && (await big.text()).startsWith('{'));
  const gone = await mkUser(db, 'alumno'); const goneEmail = `test_fx_${rnd()}@uft.invalid`;
  await db.collection('users').updateOne({ id: gone.id }, { $set: { email: goneEmail } });
  await db.collection('student_requests').insertOne({ id: `test_fx_req_${rnd()}`, studentId: gone.id, message: 'x' });
  await db.collection('availabilities').insertOne({ userId: gone.id, role: 'alumno', days: [] });
  await db.collection('notifications').insertOne({ id: `test_fx_n_${rnd()}`, toEmail: goneEmail, subject: 's', message: 'm' });
  const delRes = await adminT.agent.req('DELETE', `/api/users/${gone.id}`);
  const left = (await db.collection('student_requests').countDocuments({ studentId: gone.id })) + (await db.collection('availabilities').countDocuments({ userId: gone.id })) + (await db.collection('notifications').countDocuments({ toEmail: goneEmail }));
  ok('borrar un usuario elimina también sus solicitudes, disponibilidad y notificaciones', delRes.status === 200 && left === 0, `${delRes.status} restos=${left}`);

  console.log('\n— A-08 Cuentas importadas —');
  await db.collection('users').updateOne({ id: alumnoA.id }, { $set: { email: `test_fx_${rnd()}@uft.cl` } });
  const emailA = (await db.collection('users').findOne({ id: alumnoA.id })).email;
  const reg = await anon.req('POST', '/api/register', { name: 'Intruso', rut: validRut(), email: emailA, career: 'x', password: PWD() });
  ok('registrarse con el correo de una cuenta existente → 409 (ya no se "reclama")', reg.status === 409, reg.text);

  console.log('\n— M-04 Validación de entradas —');
  ok('solicitud de alumno con mensaje enorme → 400', (await alumnoA.agent.req('POST', '/api/student-requests', { program: 'tutorias', message: 'x'.repeat(5000), preferredTime: 'lunes' })).status === 400);
  ok('alumno no puede resolver solicitudes → 403', (await alumnoA.agent.req('PUT', '/api/student-requests/cualquiera', { status: 'resuelto' })).status === 403);
  ok('resolver una solicitud inexistente → 404 (ya no se crea con upsert)', (await docente.agent.req('PUT', '/api/student-requests/no_existe_fx', { status: 'resuelto' })).status === 404);
  ok('disponibilidad con días mal formados → 400', (await alumnoA.agent.req('POST', '/api/availabilities', { days: 'lunes' })).status === 400);
  ok('alumno no puede guardar la disponibilidad de otro', await (async () => {
    const r = await alumnoA.agent.req('POST', '/api/availabilities', { userId: alumnoB.id, role: 'alumno', userName: 'x', career: 'x', days: [{ day: 'Lunes', slots: ['09:00 - 10:30'] }] });
    const doc = await db.collection('availabilities').findOne({ userId: alumnoB.id });
    await db.collection('availabilities').deleteMany({ userId: { $in: [alumnoA.id, alumnoB.id] } });
    return r.status === 200 && !doc;
  })());

  console.log('\n— A-07 / login —');
  const t0 = Date.now();
  const bad = await anon.req('POST', '/api/login', { rut: '999999999', password: 'x' });
  ok('login con RUT inexistente → 401 genérico y rápido', bad.status === 401 && Date.now() - t0 < 3000, `${bad.status} ${Date.now() - t0}ms`);
  ok('login con tipos raros no revienta (→ 401)', (await anon.req('POST', '/api/login', { rut: { $ne: 1 }, password: { $ne: 1 } })).status === 401);
  ok('forgot-password con objeto → 400', (await anon.req('POST', '/api/forgot-password', { identifier: { $ne: '' } })).status === 400);

  console.log('\n— M-10 Bitácora —');
  const logins = await db.collection('audit_log').countDocuments({ action: 'auth.login', actor: { $regex: '^test_fx_' } });
  const creates = await db.collection('audit_log').countDocuments({ action: 'user.create', actor: docente.id });
  const lists = await db.collection('audit_log').countDocuments({ action: 'users.list_full', actor: docente.id });
  ok('se registran los ingresos', logins > 0, String(logins));
  ok('se registra la creación de usuarios (con actor)', creates > 0, String(creates));
  ok('se registra quién listó todos los usuarios', lists > 0, String(lists));
  const sample = await db.collection('audit_log').findOne({ action: 'user.create', actor: docente.id });
  ok('la bitácora no guarda RUT, correos ni contraseñas', sample && !/rut|password|email/i.test(JSON.stringify(sample.object) + JSON.stringify(sample.meta)));

  console.log('\n— Cola de correos y recordatorios —');
  const { tomorrowInSantiago } = await import('../services/cron.service.js');
  ok('tomorrowInSantiago: 23:30 de Chile del 20-nov (ya es 21-nov en UTC) → mañana = 21', tomorrowInSantiago(new Date('2026-11-21T02:30:00Z')) === '2026-11-21');
  ok('tomorrowInSantiago: 10:00 de Chile del 20-nov → mañana = 21', tomorrowInSantiago(new Date('2026-11-20T13:00:00Z')) === '2026-11-21');
  ok('/api/cron/daily sin credencial → 401', (await anon.req('GET', '/api/cron/daily')).status === 401);
  const cb = await fetch(BASE + '/api/cron/daily', { headers: { authorization: 'Bearer incorrecto-incorrecto' } });
  ok('/api/cron/daily con secreto incorrecto → 401', cb.status === 401);

  console.log('\n— Cifrado de la contraseña SMTP —');
  const { encryptField: enc, decryptField: dec, isEncrypted } = await import('../services/crypto.service.js');
  const sample2 = enc('contraseña-smtp-de-prueba');
  ok('encryptField/decryptField de la contraseña SMTP', isEncrypted(sample2) && dec(sample2) === 'contraseña-smtp-de-prueba' && dec('en-claro-antiguo') === 'en-claro-antiguo');
  const smtp = await db.collection('settings').findOne({ type: 'smtp' }, { projection: { pass: 1 } });
  console.log(`   (info) contraseña SMTP en la BD: ${smtp?.pass ? (isEncrypted(smtp.pass) ? 'cifrada' : 'EN CLARO: se cifrará con la migración o al guardar la configuración') : 'no hay'}`);
}

let failed = 0;
try {
  await main();
} catch (err) {
  console.error('\n💥 Error en la prueba:', err);
  failed = 1;
} finally {
  try {
    const db = await connectDB();
    const r1 = await db.collection('users').deleteMany({ $or: [{ id: { $in: accounts } }, { id: /^test_fx_/ }, { name: 'Test creado' }] });
    const r2 = await db.collection('sessions').deleteMany({ $or: [{ id: /^test_fx_/ }, { title: 'Sesión creada', location: 'TEST' }] });
    const r3 = await db.collection('password_resets').deleteMany({ userId: /^test_fx_/ });
    const r4 = await db.collection('audit_log').deleteMany({ $or: [{ actor: /^test_fx_/ }, { 'object.userId': /^test_fx_/ }, { 'object.sessionId': /^test_fx_/ }] });
    await db.collection('student_requests').deleteMany({ studentId: /^test_fx_/ });
    await db.collection('rooms').deleteMany({ code: 'TEST', id: /^test_fx_/ });
    await db.collection('notifications').deleteMany({ toEmail: /test_fx_.*@uft\.invalid/ });
    await db.collection('availabilities').deleteMany({ userId: /^test_fx_/ });
    await db.collection('reports').deleteMany({ tutorId: /^test_fx_/ });
    console.log(`\n🧹 Limpieza: ${r1.deletedCount} usuarios, ${r2.deletedCount} sesiones, ${r3.deletedCount} tokens y ${r4.deletedCount} eventos de prueba borrados.`);
  } catch (e) { console.error('No se pudo limpiar:', e.message); failed = 1; }
  await client?.close();
}
const fails = results.filter(r => !r.pass);
console.log(`\nResultado: ${results.length - fails.length}/${results.length} pruebas correctas${fails.length ? `, ${fails.length} fallan:` : '.'}`);
fails.forEach(f => console.log(`  ❌ ${f.name} — ${f.extra}`));
process.exit(fails.length || failed ? 1 : 0);
