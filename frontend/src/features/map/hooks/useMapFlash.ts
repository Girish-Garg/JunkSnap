import { useCallback, useEffect, useState } from 'react';

const SHOWN_MS = 4000;

export interface MapFlash {
  /** i18n key of the short message on show, or null. */
  readonly key: string | null;
  readonly announce: (key: string) => void;
}

/** A one-line toast over the map, for example after a report is withdrawn; it clears itself. */
export function useMapFlash(): MapFlash {
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    if (key === null) return undefined;
    const timer = window.setTimeout(() => setKey(null), SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [key]);
  const announce = useCallback((next: string) => setKey(next), []);
  return { key, announce };
}
