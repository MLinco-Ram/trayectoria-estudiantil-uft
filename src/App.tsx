/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth, getRoleHomePath } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/routes/ProtectedRoute';
import LoginScreen from './components/LoginScreen';

// Cada portal se descarga solo cuando el usuario entra a él (code splitting por ruta)
const ResetPasswordScreen = lazy(() => import('./components/ResetPasswordScreen'));
const DocenteDashboard = lazy(() => import('./components/DocenteDashboard'));
const TutorDashboard = lazy(() => import('./components/TutorDashboard'));
const AlumnoDashboard = lazy(() => import('./components/AlumnoDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
      <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-[#3a9ad9] animate-spin" role="status" aria-label="Cargando" />
    </div>
  );
}

// Wrapper para pantalla de restablecimiento con soporte de parámetro URL (?reset_token=xyz)
function ResetPasswordRouteWrapper() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('reset_token') || searchParams.get('token') || '';

  const handleSuccess = () => {
    navigate('/login', { replace: true });
  };

  return <ResetPasswordScreen token={token} onSuccess={handleSuccess} />;
}

// Redirección inteligente de raíz (/) según el estado de autenticación y rol
function HomeRedirect() {
  const { currentUser, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  // Si viene con reset_token en la raíz, redirigir a /reset-password
  const resetToken = searchParams.get('reset_token') || searchParams.get('token');
  if (resetToken) {
    return <Navigate to={`/reset-password?reset_token=${encodeURIComponent(resetToken)}`} replace />;
  }

  if (isAuthenticated && currentUser) {
    return <Navigate to={getRoleHomePath(currentUser.role)} replace />;
  }

  return <Navigate to="/login" replace />;
}

// Componente para Login con redirección si ya está autenticado
function LoginRouteWrapper() {
  const { currentUser, isAuthenticated } = useAuth();

  if (isAuthenticated && currentUser) {
    return <Navigate to={getRoleHomePath(currentUser.role)} replace />;
  }

  return <LoginScreen />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={<LoginRouteWrapper />} />
            <Route path="/reset-password" element={<ResetPasswordRouteWrapper />} />

            {/* Rutas Protegidas por Rol */}
            <Route
              path="/docente/*"
              element={
                <ProtectedRoute allowedRoles={['docente']}>
                  <DocenteDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/alumno/*"
              element={
                <ProtectedRoute allowedRoles={['alumno']}>
                  <AlumnoDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/tutor/*"
              element={
                <ProtectedRoute allowedRoles={['tutor']}>
                  <TutorDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Redirección Inicial y Fallback */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
