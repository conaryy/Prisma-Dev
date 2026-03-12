import { useEffect, useState } from 'react';
import { loadStorage, saveStorage } from '@/lib/storage';

export function useLocalStorageState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => loadStorage(key, initial));

  useEffect(() => {
    setState(loadStorage(key, initial));
  }, [key, initial]);

  useEffect(() => {
    saveStorage(key, state);
  }, [key, state]);

  return [state, setState] as const;
}
