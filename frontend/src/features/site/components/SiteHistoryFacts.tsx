import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { useFormatter } from '../../../i18n/useFormatter';
import { FactList } from '../../../ui/FactList';

interface SiteHistoryFactsProps {
  readonly site: SiteProperties;
}

export function SiteHistoryFacts({ site }: SiteHistoryFactsProps) {
  const { t } = useTranslation();
  const format = useFormatter();
  const cleared = site.cleaned_at
    ? [{ label: t('site.lastCleared'), value: format.dateTime(site.cleaned_at) }]
    : [];
  const facts = [
    { label: t('site.firstReported'), value: format.dateTime(site.first_reported_at) },
    { label: t('site.lastReported'), value: format.dateTime(site.last_reported_at) },
    ...cleared,
  ];
  return <FactList title={t('site.history')} facts={facts} />;
}
