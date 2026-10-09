import { useTranslation } from 'react-i18next';
import type { SiteLocation } from '../../../domain/Site';
import { FactList } from '../../../ui/FactList';

interface SiteLocationFactsProps {
  readonly location: SiteLocation;
}

// Area names are data, so they stay untranslated.
export function SiteLocationFacts({ location }: SiteLocationFactsProps) {
  const { t } = useTranslation();
  const facts = [
    { label: t('site.localBody'), value: location.local_body?.name ?? t('site.notKnown') },
    { label: t('site.ward'), value: location.ward?.name ?? t('site.noWard') },
    { label: t('site.assemblySeat'), value: location.assembly_seat.name },
    { label: t('site.loksabhaSeat'), value: location.loksabha_seat.name },
  ];
  return <FactList title={t('site.location')} facts={facts} />;
}
