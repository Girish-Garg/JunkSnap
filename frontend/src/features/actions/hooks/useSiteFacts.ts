import { useCallback, useMemo } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import { FreshFix } from '../../../domain/FreshFix';
import type { LocationProblem } from '../../../domain/LocationError';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { SiteActionFacts } from '../../../domain/SiteActionGates';
import { SitePhotoPreset } from '../../../domain/SitePhotoPreset';
import { metresBetween } from '../../../domain/utils';
import { useFreshFix } from './useFreshFix';
import { useLocationAccess } from './useLocationAccess';
import { useOwnSite } from './useOwnSite';
import { useSessionFacts } from './useSessionFacts';

export interface SiteFacts {
  readonly facts: SiteActionFacts;
  /** Takes a fresh fix (it may ask) and returns the metres to the site or what kept the fix; null without a location API. */
  readonly measure: (() => Promise<number | LocationProblem>) | null;
}

/**
 * Everything the site gates read: the session, the site, whether this person reported it and a fresh distance to it.
 * What is still loading (the saved sign-in, this person's reports, the first fix) is marked, so no action looks open
 * before it is known.
 */
export function useSiteFacts(site: SiteFeature, mapLocation: LonLat | null): SiteFacts {
  const session = useSessionFacts();
  const { site: rules } = useConfig();
  const { ownSite, checkingOwner } = useOwnSite(site.properties.site_id, session);
  const { locator } = useServices();
  const locationDenied = useLocationAccess() === 'denied';
  const { fix, locating, relocate } = useFreshFix(mapLocation);
  const point = site.geometry.coordinates;
  const distanceM = fix ? metresBetween(fix.at, point) : null;
  const { properties } = site;
  const addPhotoLimitM = useMemo(() => SitePhotoPreset.of(site, rules).limitM(true), [site, rules]);
  const facts = useMemo(
    () => ({ ...session, site: properties, ownSite, checkingOwner, distanceM, locating, locationDenied, addPhotoLimitM, reach: rules }),
    [session, properties, ownSite, checkingOwner, distanceM, locating, locationDenied, addPhotoLimitM, rules],
  );
  const measure = useCallback(() => relocate().then((fresh) => (fresh instanceof FreshFix ? metresBetween(fresh.at, point) : fresh)), [relocate, point]);
  return { facts, measure: locator.canLocate() ? measure : null };
}
