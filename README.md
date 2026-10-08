# 🎓 Trayectoria UFT — Plataforma de Gestión y Seguimiento de Tutorías

<div align="center">

![Universidad Finis Terrae](public/logo-uft.png)

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Socket.io](https://img.shields.io/badge/Socket.io-WebSockets-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)

**Plataforma web integral para la Universidad Finis Terrae orientada a la coordinación flexible, reserva, gestión académica y auditoría de tutorías entre pares y acompañamiento psicoeducativo.**

[Características](#-características-principales) • [Roles](#-portales-y-roles-del-sistema) • [Seguridad](#-seguridad-y-cifrado) • [Instalación](#-instalación-y-despliegue-local) • [Cuentas de Prueba](#-cuentas-de-prueba)

---

</div>

## 📌 Descripción del Proyecto

**Trayectoria UFT.** centraliza y digitaliza los programas de apoyo académico y estudiantil de la **Universidad Finis Terrae**:
1. **Programa de Tutorías Académicas** (Tutorías entre pares y docentes).
2. **Programa de Apoyo Psicoeducativo** (Talleres de hábitos de estudio, manejo de ansiedad y asesorías individualizadas).

La plataforma conecta en tiempo real a estudiantes, tutores pares, coordinadores docentes y administradores de sistemas a través de una arquitectura moderna sincronizada con **MongoDB Atlas** y **WebSockets**.

---

## 🚀 Características Principales

- 🔄 **Sincronización en Tiempo Real**: Notificaciones y actualizaciones instantáneas con WebSockets (`Socket.io`) y MongoDB Atlas.
- 👥 **Jerarquía de Tutores (Tutor de Tutores / Tutor Par)**: Módulo de supervisión con auditoría de cumplimiento en vivo y despacho de recordatorios institucionales.
- 📱 **Pase de Asistencia con Código QR**: Escaneo móvil y validación en vivo de asistencia estudiantil.
- ⏳ **Inscripción con Ventana de Tiempo**: Regla de negocio que exige reservar cupos con al menos 2 horas de anticipación a la sesión.
- 📋 **Cronograma y Temarios Desplegables**: Visualización del plan de trabajo por parte de alumnos y supervisores.
- ⭐ **Encuestas de Satisfacción**: Calificación con estrellas (1 a 5) y comentarios directos de los estudiantes.
- ✉️ **Correos Transaccionales SMTP**: Plantillas HTML institucionales con incrustación inline de logotipos para avisos de inscripciones, cambios de horario e incidencias.

---

## 🏛️ Portales y Roles del Sistema

### 1. 🎓 Portal Docente / Coordinación (`/docente`)
- **Gestión de Tutores**: Creación y edición de tutores clasificándolos como **Tutor Par** o **Tutor de Tutores** (Coordinador de Pares).
- **Asignación de Tutores a Cargo**: Asignación interactiva multiselección de tutores pares bajo la supervisión de un Tutor de Tutores.
- **Calendario Académico**: Programación de tutorías masivas, talleres e inducciones con cupos máximos.
- **Horarios Flexibles & Inconvenientes**: Bandeja de resolución de solicitudes de alumnos con tope de horario.
- **Comunicados Masivos**: Envío de avisos institucionales con filtros por carrera o programa.

### 2. 🛡️ Portal de Tutor de Tutores & Tutores Pares (`/tutor`)
- **Mis Tutorías**: Visualización de sesiones asignadas, carga de temarios/cronogramas y toma de asistencia con QR interactivo.
- **Cargar Horario**: Matriz de disponibilidad semanal (Lunes a Domingo).
- **Avisar Inconveniente**: Reporte formal de tope horario o reasignación a docentes coordinadores.
- **Pestañas Exclusivas para Tutor de Tutores**:
  - **Tutores a Cargo**: Métricas rápidas de los tutores asignados (tutorías este mes, estado de cronograma, asistencia al día y alertas).
  - **Revisión de Cumplimiento**: Auditoría individual por sesión con cálculo automático de estado:
    - `Cumplida` (Verde): Temario cargado + Asistencia al 100% + Sin alertas.
    - `Sin cronograma` (Ámbar): Sesión sin temario registrado por el tutor.
    - `Inconsistente` (Rojo): Sesión vencida sin asistencia o con alerta activa.
    - `Pendiente` (Gris): Sesión agendada para el futuro.
  - **Desglose de Parámetros**: Al presionar una tutoría, se auditan los 5 parámetros y se muestra la **nota promedio de satisfacción** y comentarios de los alumnos.

### 3. 📚 Portal Alumno (`/alumno`)
- **Explorador y Reserva**: Inscripción inmediata en tutorías y talleres psicoeducativos.
- **Mis Reservas Activas**: Visualización de datos de la sesión, contacto del tutor y temario.
- **Historial de Clases**: Asistencias confirmadas con **acordeón desplegable para consultar el cronograma/temario**.
- **Evaluación y Feedback**: Envío de calificaciones de satisfacción (estrellas y comentarios).
- **Avisos de Inconveniente**: Formulario de solicitud de horario flexible por tope de ramos.

### 4. ⚙️ Portal Administrador TI (`/admin`)
- **Gestión de Usuarios**: Altas, bajas y modificaciones seguras de docentes, tutores y estudiantes.
- **Configuración SMTP**: Parametrización y pruebas en vivo de servidores de correo electrónico.
- **Métricas del Sistema**: Monitoreo de documentos y estado de MongoDB Atlas.

---

## 🔒 Seguridad y Cifrado

- **Cifrado en Reposo (Field-Level Encryption)**: Los números de RUT se cifran en MongoDB Atlas mediante **AES-256-GCM** (`enc:<iv>:<tag>:<cipher>`).
- **Blind Index Determinístico**: Búsquedas instantáneas $O(1)$ sin descifrar mediante **HMAC-SHA256** (`rutHash`).
- **Hashing de Contraseñas**: Contraseñas resguardadas con `bcryptjs`.
- **Protección HTTP**: Cabeceras seguras con `helmet` y limitación de tasa con `express-rate-limit`.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS v4, Lucide React, Framer Motion |
| **Backend** | Node.js, Express 4 (Arquitectura Modular por Capas), TSX |
| **Base de Datos** | MongoDB Atlas (driver oficial `mongodb` v7.x con Connection Pooling) |
| **Tiempo Real** | WebSockets con Socket.io |
| **Correos SMTP** | Nodemailer con transporte seguro |

---

## 💻 Instalación y Despliegue Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/MLinco-Ram/trayectoria-estudiantil-uft.git
cd trayectoria-estudiantil-uft
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto tomando como referencia `.env.example`:
```env
PORT=3001
MONGODB_URI=tu_cadena_de_conexion_mongodb_atlas
DATA_ENCRYPTION_KEY=tu_clave_secreta_hex_de_64_caracteres
HMAC_SECRET=tu_clave_hmac_secreta
```

### 4. Iniciar la aplicación en modo desarrollo
```bash
# Inicia tanto el backend (puerto 3001) como el frontend (puerto 3000)
npm run dev
```

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`

---

## 🧪 Cuentas de Prueba

| Rol | Nombre | RUT / Usuario | Contraseña |
| :--- | :--- | :--- | :--- |
| **Docente Coordinador** | Viviana Carrasco | `11.111.111-1` | `123` |
| **Tutor de Tutores** | Carlos Valenzuela | `18.456.789-K` | `123` |
| **Tutor Par** | Anaís Belén | `19.876.543-2` | `123` |
| **Estudiante** | Mayra Linco | `20.123.456-7` | `123` |
| **Administrador TI** | Administrador | `admin` | `1234` |

---

## 📄 Scripts Disponibles

- `npm run dev`: Ejecuta cliente y servidor concurrentemente.
- `npm run server`: Inicia el servidor backend Express con recarga en vivo (`tsx watch`).
- `npm run client`: Inicia el entorno de desarrollo Vite para React.
- `npm run lint`: Chequeo estático de tipos con TypeScript (`tsc --noEmit`).
- `npm run build`: Compilación optimizada para producción.

---

<div align="center">
  <p><strong>Dirección de Trayectoria Estudiantil • Universidad Finis Terrae</strong></p>
</div>
