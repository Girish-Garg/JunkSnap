import { useMemo } from 'react';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { SiteActionFacts } from '../../../domain/SiteActionGates';
import { SiteListing } from '../../../domain/SiteListing';
import { metresBetween } from '../../../domain/utils';
import { usePermissionDenied } from '../../../ui/usePermissionDenied';
import { useQueue } from '../../snap/hooks/useQueue';
import { useSessionFacts } from './useSessionFacts';

/** Everything the site gates read: the session, the site, this phone's reports on it and how far away the person is. */
export function useSiteFacts(site: SiteFeature, userLocation: LonLat | null): SiteActionFacts {
  const session = useSessionFacts();
  const ownSite = SiteListing.reportedHere(useQueue(), site.properties.site_id).length > 0;
  const locationDenied = usePermissionDenied('geolocation');
  const distanceM = userLocation ? metresBetween(userLocation, site.geometry.coordinates) : null;
  const { properties } = site;
  return useMemo(
    () => ({ ...session, site: properties, ownSite, distanceM, locationDenied }),
    [session, properties, ownSite, distanceM, locationDenied],
  );
}
