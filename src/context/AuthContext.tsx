import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { getSavedUsers, saveUsers } from '../data';

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
  localStorage.setItem('uft_session_user', JSON.stringify(user));
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
  const local = localStorage.getItem('uft_session_user');
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.warn('Error leyendo sesión de localStorage:', e);
    }
  }
  return null;
}

function removeSessionCookie() {
  document.cookie = 'uft_session_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
  localStorage.removeItem('uft_session_user');
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

    const currentList = getSavedUsers();
    const index = currentList.findIndex(u => u.id === updatedUser.id || u.rut === updatedUser.rut);
    if (index >= 0) {
      currentList[index] = { ...currentList[index], ...updatedUser };
    } else {
      currentList.push(updatedUser);
    }
    saveUsers(currentList);
  };

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
