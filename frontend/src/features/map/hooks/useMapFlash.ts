import { useCallback, useEffect, useState } from 'react';
import { useConfig } from '../../../app/useConfig';

export interface MapFlash {
  /** i18n key of the short message on show, or null. */
  readonly key: string | null;
  readonly announce: (key: string) => void;
}

/** A one-line toast over the map, for example after a report is withdrawn; it clears itself after map.flashMs. */
export function useMapFlash(): MapFlash {
  const { flashMs } = useConfig().map;
  const [key, setKey] = useState<string | null>(null);
  useEffect(() => {
    if (key === null) return undefined;
    const timer = window.setTimeout(() => setKey(null), flashMs);
    return () => window.clearTimeout(timer);
  }, [key, flashMs]);
  const announce = useCallback((next: string) => setKey(next), []);
  return { key, announce };
}
