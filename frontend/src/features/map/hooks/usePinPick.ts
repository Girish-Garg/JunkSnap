import { useCallback, useMemo, useState } from 'react';
import type { SiteFeature } from '../../../domain/Site';
import { SiteListing } from '../../../domain/SiteListing';

/** One site previewed in the card, or the ids of a stack pin listed in the stack sheet; never both. */
type Picked = { readonly site: SiteFeature } | { readonly stackIds: readonly string[] } | null;

/**
 * What the last tap on a pin picked. A stack is read from the loaded sites on every render, so a site that
 * was withdrawn, removed or cleared (and so left the map) also leaves an open list; an emptied list closes.
 */
export function usePinPick(loaded: readonly SiteFeature[]) {
  const [picked, setPicked] = useState<Picked>(null);
  const preview = useCallback((site: SiteFeature | null) => setPicked(site ? { site } : null), []);
  const pick = useCallback(
    (siteId: string | null) => preview(loaded.find((site) => site.properties.site_id === siteId) ?? null),
    [loaded, preview],
  );
  const pickStack = useCallback((stackIds: readonly string[]) => setPicked({ stackIds }), []);
  const stackIds = picked && 'stackIds' in picked ? picked.stackIds : null;
  const stack = useMemo(() => {
    if (!stackIds) return null;
    const sites = loaded.filter((site) => stackIds.includes(site.properties.site_id) && SiteListing.onMap(site.properties));
    return sites.length > 0 ? sites : null;
  }, [loaded, stackIds]);
  return { preview: picked && 'site' in picked ? picked.site : null, stack, setPreview: preview, pick, pickStack };
}
