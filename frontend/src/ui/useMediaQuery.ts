import { useCallback, useSyncExternalStore } from 'react';

/** Desktop layout: side panel beside the map, no bottom bar. layout.css and SiteMap use the same width. */
export const DESKTOP_QUERY = '(min-width: 1024px)';

function media(query: string): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = media(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => media(query)?.matches ?? false, () => false);
}
