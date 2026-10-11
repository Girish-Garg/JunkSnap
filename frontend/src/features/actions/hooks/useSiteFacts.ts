import { useCallback, useMemo } from 'react';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { SiteActionFacts } from '../../../domain/SiteActionGates';
import { SitePhotoPreset } from '../../../domain/SitePhotoPreset';
import { metresBetween } from '../../../domain/utils';
import { usePermissionState } from '../../../ui/usePermissionState';
import { useFreshFix } from './useFreshFix';
import { useOwnSite } from './useOwnSite';
import { useSessionFacts } from './useSessionFacts';

export interface SiteFacts {
  readonly facts: SiteActionFacts;
  /** Takes a fresh fix and returns the metres to the site, or null when the browser gives no fix. */
  readonly remeasure: () => Promise<number | null>;
}

/**
 * Everything the site gates read: the session, the site, whether this person reported it and a fresh distance to it.
 * What is still loading (the saved sign-in, this person's reports, the first fix) is marked, so no action looks open
 * before it is known.
 */
export function useSiteFacts(site: SiteFeature, mapLocation: LonLat | null): SiteFacts {
  const session = useSessionFacts();
  const { ownSite, checkingOwner } = useOwnSite(site.properties.site_id, session);
  const locationDenied = usePermissionState('geolocation') === 'denied';
  const { fix, locating, relocate } = useFreshFix(mapLocation);
  const point = site.geometry.coordinates;
  const distanceM = fix ? metresBetween(fix.at, point) : null;
  const { properties } = site;
  const addPhotoLimitM = useMemo(() => SitePhotoPreset.of(site).limitM(true), [site]);
  const facts = useMemo(
    () => ({ ...session, site: properties, ownSite, checkingOwner, distanceM, locating, locationDenied, addPhotoLimitM }),
    [session, properties, ownSite, checkingOwner, distanceM, locating, locationDenied, addPhotoLimitM],
  );
  const remeasure = useCallback(() => relocate().then((fresh) => (fresh ? metresBetween(fresh.at, point) : null)), [relocate, point]);
  return { facts, remeasure };
}
