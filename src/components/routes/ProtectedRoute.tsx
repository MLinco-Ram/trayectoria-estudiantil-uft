import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Role } from '../../types';
import { useAuth, getRoleHomePath } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Si no tiene el rol permitido, redirigir a su propio home de rol
    return <Navigate to={getRoleHomePath(currentUser.role)} replace />;
  }

  return <>{children}</>;
};
