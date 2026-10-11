import { useEffect } from 'react';
import { sitePath } from '../../../app/paths';
import { useSheetNavigation } from '../../../app/useSheetNavigation';
import { MergedSite } from '../../../domain/MergedSite';
import type { SiteFeature } from '../../../domain/Site';

/**
 * Decision 20261011-1730-hem-merged-sites: a merged duplicate, reached from a shared link, a deep link or Activity,
 * opens the site it merged into in its place, so back skips it. True while that switch is under way.
 */
export function useMergedSiteRedirect(site: SiteFeature | null): boolean {
  const sheets = useSheetNavigation();
  const target = site ? MergedSite.target(site.properties) : null;
  useEffect(() => {
    if (target) sheets.swap(sitePath(target));
  }, [target, sheets]);
  return target !== null;
}
