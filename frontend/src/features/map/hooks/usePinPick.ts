import { useCallback, useState } from 'react';
import type { SiteFeature } from '../../../domain/Site';

/** One site previewed in the card, or the sites of a stack pin listed in the stack sheet; never both. */
type Picked = { readonly site: SiteFeature } | { readonly stack: readonly SiteFeature[] } | null;

/** What the last tap on a pin picked, looked up among the loaded sites. */
export function usePinPick(loaded: readonly SiteFeature[]) {
  const [picked, setPicked] = useState<Picked>(null);
  const preview = useCallback((site: SiteFeature | null) => setPicked(site ? { site } : null), []);
  const pick = useCallback(
    (siteId: string | null) => preview(loaded.find((site) => site.properties.site_id === siteId) ?? null),
    [loaded, preview],
  );
  const pickStack = useCallback(
    (siteIds: readonly string[]) => {
      const stack = loaded.filter((site) => siteIds.includes(site.properties.site_id));
      setPicked(stack.length > 0 ? { stack } : null);
    },
    [loaded],
  );
  return {
    preview: picked && 'site' in picked ? picked.site : null,
    stack: picked && 'stack' in picked ? picked.stack : null,
    setPreview: preview,
    pick,
    pickStack,
  };
}
