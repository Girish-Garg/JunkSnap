import { useMemo } from 'react';
import { ShareLinks } from '../services/ShareLinks';
import { useServices } from './useServices';

/** Share links for this stage: the link previews in live mode (VITE_SHARE_URL, else the api), the web app in mock mode. */
export function useShareLinks(): ShareLinks {
  const { config } = useServices();
  return useMemo(() => {
    const api = config.apiMode === 'live' ? (config.shareUrl ?? config.apiUrl) : null;
    return new ShareLinks(api, config.webUrl ?? window.location.origin);
  }, [config]);
}
