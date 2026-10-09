import { useEffect } from 'react';

export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onEscape]);
}
