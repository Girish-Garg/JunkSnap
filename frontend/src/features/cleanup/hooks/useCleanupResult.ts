import { useState } from 'react';
import { CleanupOutcome, type CleanupResult } from '../../../domain/CleanupOutcome';
import type { SiteFeature } from '../../../domain/Site';

/**
 * This after-photo's result from the polled site. The site read before the claim may hold an old result, so only a
 * later read counts. The first result shown then stays: a newer photo from someone else, or a removed site, says
 * nothing more about this one.
 */
export function useCleanupResult(site: SiteFeature | null, cleanupId: string): CleanupResult {
  const [beforeClaim] = useState(site);
  const [shown, setShown] = useState<CleanupResult | null>(null);
  const fresh = site !== null && site !== beforeClaim;
  const live = fresh ? CleanupOutcome.of(site.properties, cleanupId) : 'checking';
  if (shown === null && live !== 'checking') setShown(live);
  return shown ?? live;
}
