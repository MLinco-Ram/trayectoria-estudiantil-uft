import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Role } from '../../types';
import { useAuth, getRoleHomePath } from '../../context/AuthContext';
import ForceChangePasswordScreen from '../ForceChangePasswordScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { currentUser, isAuthenticated, isLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && currentUser && currentUser.role !== 'alumno') {
        logout();
        navigate(`/login?mobile_restricted=true&role=${currentUser.role}`, { replace: true });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentUser, logout, navigate]);

  // Se está comprobando la sesión con el servidor
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-[#3a9ad9] animate-spin" role="status" aria-label="Cargando" />
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // RESTRICCIÓN MÓVIL: En dispositivos móviles solo puede ingresar y usar la app el estudiante (rol 'alumno')
  if (currentUser.role !== 'alumno' && (isMobile || (typeof window !== 'undefined' && window.innerWidth < 768))) {
    logout();
    return <Navigate to={`/login?mobile_restricted=true&role=${currentUser.role}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Si no tiene el rol permitido, redirigir a su propio home de rol
    return <Navigate to={getRoleHomePath(currentUser.role)} replace />;
  }

  // Primer ingreso con contraseña inicial: no se muestra el panel hasta cambiarla
  if (currentUser.mustChangePassword) {
    return <ForceChangePasswordScreen />;
  }

  return <>{children}</>;
};
