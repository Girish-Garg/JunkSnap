import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { SiteDistance } from '../../../domain/SiteDistance';
import { useFormatter } from '../../../i18n/useFormatter';

export interface SiteDistanceText {
  /** "3.5 km", for the pin card's meta line. */
  readonly short: string;
  /** "3.5 km away", for the site sheet. */
  readonly label: string;
}

/** The distance to a site in words; null when the app has no location fix, so nothing is shown. */
export function useSiteDistance(site: SiteFeature, userLocation: LonLat | null): SiteDistanceText | null {
  const { t } = useTranslation();
  const format = useFormatter();
  const metres = SiteDistance.metres(site, userLocation);
  if (metres === null) return null;
  const short = format.distance(metres);
  return { short, label: t('site.distanceAway', { distance: short }) };
}
