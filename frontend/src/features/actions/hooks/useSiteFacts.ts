import { useCallback, useMemo } from 'react';
import { useConfig } from '../../../app/useConfig';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { SiteActionFacts } from '../../../domain/SiteActionGates';
import { SiteListing } from '../../../domain/SiteListing';
import { SitePhotoPreset } from '../../../domain/SitePhotoPreset';
import { metresBetween } from '../../../domain/utils';
import { usePermissionState } from '../../../ui/usePermissionState';
import { useQueue } from '../../snap/hooks/useQueue';
import { useFreshFix } from './useFreshFix';
import { useSessionFacts } from './useSessionFacts';

export interface SiteFacts {
  readonly facts: SiteActionFacts;
  /** Takes a fresh fix and returns the metres to the site, or null when the browser gives no fix. */
  readonly remeasure: () => Promise<number | null>;
}

/** Everything the site gates read: the session, the site, this phone's reports on it and a fresh distance to it. */
export function useSiteFacts(site: SiteFeature, mapLocation: LonLat | null): SiteFacts {
  const session = useSessionFacts();
  const { site: rules } = useConfig();
  const ownSite = SiteListing.reportedHere(useQueue(), site.properties.site_id).length > 0;
  const locationDenied = usePermissionState('geolocation') === 'denied';
  const { fix, relocate } = useFreshFix(mapLocation);
  const point = site.geometry.coordinates;
  const distanceM = fix ? metresBetween(fix.at, point) : null;
  const { properties } = site;
  const addPhotoLimitM = useMemo(() => SitePhotoPreset.of(site, rules).limitM(true), [site, rules]);
  const facts = useMemo(
    () => ({ ...session, site: properties, ownSite, distanceM, locationDenied, addPhotoLimitM, reach: rules }),
    [session, properties, ownSite, distanceM, locationDenied, addPhotoLimitM, rules],
  );
  const remeasure = useCallback(() => relocate().then((fresh) => (fresh ? metresBetween(fresh.at, point) : null)), [relocate, point]);
  return { facts, remeasure };
}
