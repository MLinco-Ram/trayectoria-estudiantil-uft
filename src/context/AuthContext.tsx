import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cookie Helpers
function setSessionCookie(user: User, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `uft_session_user=${encodeURIComponent(JSON.stringify(user))}; expires=${expires}; path=/; SameSite=Lax`;
}

function getSessionCookie(): User | null {
  const match = document.cookie.match(new RegExp('(^| )uft_session_user=([^;]+)'));
  if (match && match[2]) {
    try {
      return JSON.parse(decodeURIComponent(match[2]));
    } catch (e) {
      console.warn('Error leyendo cookie de sesión:', e);
    }
  }
  return null;
}

function removeSessionCookie() {
  document.cookie = 'uft_session_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getSessionCookie());

  const login = (user: User) => {
    setSessionCookie(user);
    setCurrentUser(user);
  };

  const logout = () => {
    removeSessionCookie();
    setCurrentUser(null);
  };

  const updateUser = (updatedUser: User) => {
    setSessionCookie(updatedUser);
    setCurrentUser(updatedUser);
  };

  // La sesión guarda una copia del usuario tomada al iniciar sesión. Se refresca desde MongoDB
  // al abrir la app y cada vez que cambian los usuarios, para que carrera, roles y tipos de tutor
  // no queden desactualizados en ningún navegador.
  const sessionUserId = currentUser?.id;
  useEffect(() => {
    if (!sessionUserId) return;
    let cancelled = false;

    const refreshFromDb = async () => {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) return;
        const users = await res.json();
        if (cancelled || !Array.isArray(users)) return;
        const fresh: User | undefined = users.find((u: User) => u && u.id === sessionUserId);
        if (!fresh) return; // ej. cuenta especial de administrador, que no vive en la colección

        setCurrentUser(prev => {
          if (!prev || prev.id !== sessionUserId) return prev;
          const roles: Role[] = Array.isArray(fresh.roles) && fresh.roles.length > 0 ? fresh.roles : [fresh.role];
          const tutorTypes = Array.isArray(fresh.tutorTypes) && fresh.tutorTypes.length > 0
            ? fresh.tutorTypes
            : (fresh.tutorType ? [fresh.tutorType] : []);
          // Se conserva el portal elegido en esta sesión mientras el usuario siga teniendo ese rol
          const role = roles.includes(prev.role) ? prev.role : roles[0];
          const tutorType = prev.tutorType && tutorTypes.includes(prev.tutorType) ? prev.tutorType : (tutorTypes[0] ?? fresh.tutorType);
          const { password: _password, ...prevWithoutPassword } = prev;
          const next: User = { ...prevWithoutPassword, ...fresh, role, roles, tutorType };
          if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
          setSessionCookie(next);
          return next;
        });
      } catch (e) {
        // Sin conexión: se mantiene la sesión actual
      }
    };

    refreshFromDb();

    let unsubscribe = () => {};
    import('../services/socket').then(({ getSocket }) => {
      if (cancelled) return;
      const socket = getSocket();
      socket.on('users:changed', refreshFromDb);
      unsubscribe = () => socket.off('users:changed', refreshFromDb);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionUserId]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        login,
        logout,
        updateUser,
        isAuthenticated: Boolean(currentUser),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};

export const getRoleHomePath = (role?: Role): string => {
  switch (role) {
    case 'docente':
      return '/docente';
    case 'alumno':
      return '/alumno';
    case 'tutor':
      return '/tutor';
    case 'admin':
      return '/admin';
    default:
      return '/login';
  }
};
