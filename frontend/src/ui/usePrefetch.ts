import { useEffect } from 'react';

/** Warms the cache for the photos either side, so a swipe shows them at once; nothing further is loaded. */
export function usePrefetch(urls: readonly (string | undefined)[]): void {
  const key = urls.join('\n');
  useEffect(() => {
    for (const url of key.split('\n')) {
      if (url) new Image().src = url;
    }
  }, [key]);
}
