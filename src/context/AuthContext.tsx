import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// La sesión real es la cookie httpOnly `uft_session` del servidor, que el navegador no puede leer ni editar.
// El usuario vive solo en memoria y se carga desde /api/me; ya no se guarda en ninguna cookie legible.
// Lo único que se recuerda en esta pestaña es el portal elegido (rol y tipo de tutor), y siempre se
// valida contra los roles que devuelve el servidor, así que editarlo no da acceso a nada.
const PORTAL_KEY = 'uft_portal';

function readPortal(): { role?: Role; tutorType?: User['tutorType'] } {
  try {
    return JSON.parse(sessionStorage.getItem(PORTAL_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function savePortal(user: User | null) {
  try {
    if (user) sessionStorage.setItem(PORTAL_KEY, JSON.stringify({ role: user.role, tutorType: user.tutorType }));
    else sessionStorage.removeItem(PORTAL_KEY);
  } catch {
    // Sin sessionStorage (modo privado, bloqueo): se usa el portal principal
  }
}

// Borra la cookie legible que dejaban las versiones anteriores
function removeLegacyCookie() {
  document.cookie = 'uft_session_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
}

// Usuario de /api/me con el portal que la persona había elegido (solo si sigue teniendo ese rol)
function withPortal(fresh: User, prev?: Pick<User, 'role' | 'tutorType'> | null): User {
  const roles: Role[] = Array.isArray(fresh.roles) && fresh.roles.length > 0 ? fresh.roles : [fresh.role];
  const tutorTypes = Array.isArray(fresh.tutorTypes) && fresh.tutorTypes.length > 0
    ? fresh.tutorTypes
    : (fresh.tutorType ? [fresh.tutorType] : []);
  const wanted = prev || readPortal();
  const role = wanted.role && roles.includes(wanted.role) ? wanted.role : roles[0];
  const tutorType = wanted.tutorType && tutorTypes.includes(wanted.tutorType) ? wanted.tutorType : (tutorTypes[0] ?? fresh.tutorType);
  const { password: _password, ...rest } = fresh as User & { password?: string };
  return { ...rest, role, roles, tutorType, mustChangePassword: Boolean(fresh.mustChangePassword) };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // Mientras se consulta /api/me al abrir la app no se sabe si hay sesión: las rutas esperan
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    removeLegacyCookie();
    let cancelled = false;
    fetch('/api/me')
      .then(res => (res.ok ? res.json() : null))
      .then((fresh: User | null) => {
        if (!cancelled && fresh && fresh.id) setCurrentUser(withPortal(fresh));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = (user: User) => {
    savePortal(user);
    setCurrentUser(user);
  };

  const logout = () => {
    savePortal(null);
    setCurrentUser(null);
    // Invalida la cookie httpOnly de sesión del servidor
    fetch('/api/logout', { method: 'POST' }).catch(() => {});
  };

  const updateUser = (updatedUser: User) => {
    savePortal(updatedUser);
    setCurrentUser(updatedUser);
  };

  // Se refresca desde la base (/api/me) cada vez que cambian los usuarios, para que carrera, roles
  // y tipos de tutor no queden desactualizados en ningún navegador.
  const sessionUserId = currentUser?.id;
  useEffect(() => {
    if (!sessionUserId) return;
    let cancelled = false;

    const refreshFromDb = async () => {
      try {
        const res = await fetch('/api/me');
        if (res.status === 401) {
          // La sesión del servidor expiró, se cerró o la cuenta ya no existe
          if (!cancelled) setCurrentUser(null);
          return;
        }
        if (!res.ok) return;
        const fresh: User = await res.json();
        if (cancelled || !fresh || fresh.id !== sessionUserId) return;

        setCurrentUser(prev => {
          if (!prev || prev.id !== sessionUserId) return prev;
          // Se conserva el portal elegido en esta sesión mientras la persona siga teniendo ese rol
          const next = withPortal(fresh, { role: prev.role, tutorType: prev.tutorType });
          return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
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
        isLoading,
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
