import { useTranslation } from 'react-i18next';
import type { SiteLocation } from '../../../domain/Site';

interface SiteLocationLineProps {
  readonly location: SiteLocation;
}

export function SiteLocationLine({ location }: SiteLocationLineProps) {
  const { t } = useTranslation();
  const parts = [
    location.ward?.name ?? t('site.noWard'),
    t('site.mla', { name: location.assembly_seat.name }),
    t('site.mp', { name: location.loksabha_seat.name }),
  ];
  return <p className="site-location-line">{parts.join(' · ')}</p>;
}
