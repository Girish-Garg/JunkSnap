import { useTranslation } from 'react-i18next';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { metresBetween } from '../../../domain/utils';
import { useFormatter } from '../../../i18n/useFormatter';

export function useDistanceLabel(site: SiteFeature, userLocation: LonLat | null): string | null {
  const { t } = useTranslation();
  const format = useFormatter();
  if (!userLocation) return null;
  const distance = format.distance(metresBetween(userLocation, site.geometry.coordinates));
  return t('site.distanceAway', { distance });
}
