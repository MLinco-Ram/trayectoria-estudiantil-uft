import { useCallback, useEffect, useState } from 'react';
import { DictionaryEntry } from '../types';
import { dictionaryApi } from '../services/api';
import { getSocket } from '../services/socket';
import { setDictionary } from '../data';

/**
 * Carga el Diccionario (materias/áreas y programas adicionales), lo registra en data.ts
 * y vuelve a renderizar cuando cambia (también en tiempo real por WebSocket).
 */
export function useDictionary() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);

  const reload = useCallback(async () => {
    try {
      const list = await dictionaryApi.getEntries();
      if (Array.isArray(list)) {
        setDictionary(list);
        setEntries(list);
      }
    } catch {
      // Sin diccionario se usan solo los programas y materias base
    }
  }, []);

  useEffect(() => {
    reload();
    const socket = getSocket();
    socket.on('dictionary:changed', reload);
    return () => { socket.off('dictionary:changed', reload); };
  }, [reload]);

  return { entries, reload };
}
