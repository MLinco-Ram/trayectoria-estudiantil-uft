import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

// Estado "tutorial ya visto" guardado en MongoDB (users.tutorialsSeen), no en el navegador:
// quien ya vio un tutorial no lo vuelve a ver aunque cambie de equipo o borre datos del navegador.
export function useTutorialSeen() {
  const { currentUser, updateUser } = useAuth();

  const hasSeen = useCallback(
    (key: string) => {
      if (!currentUser) return true;
      return Array.isArray(currentUser.tutorialsSeen) && currentUser.tutorialsSeen.includes(key);
    },
    [currentUser]
  );

  const markSeen = useCallback(
    async (key: string) => {
      if (!currentUser || hasSeen(key)) return;
      // Actualización optimista para que no se vuelva a abrir mientras responde el servidor
      updateUser({ ...currentUser, tutorialsSeen: [...(currentUser.tutorialsSeen || []), key] });
      try {
        await authApi.markTutorialSeen(key);
      } catch (e) {
        console.warn('No se pudo registrar el tutorial como visto:', e);
      }
    },
    [currentUser, hasSeen, updateUser]
  );

  return { hasSeen, markSeen };
}

// Migra el registro antiguo de localStorage: si este navegador ya lo había visto, lo informa a la BD.
export function legacyTutorialSeen(storageKey: string): boolean {
  try {
    return Boolean(localStorage.getItem(storageKey));
  } catch {
    return false;
  }
}
