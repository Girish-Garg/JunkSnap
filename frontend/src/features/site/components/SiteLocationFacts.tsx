import { useTranslation } from 'react-i18next';
import type { SiteLocation } from '../../../domain/Site';
import { FactList } from '../../../ui/FactList';
import { useLocationPresenter } from '../hooks/useLocationPresenter';

interface SiteLocationFactsProps {
  readonly location: SiteLocation;
}

export function SiteLocationFacts({ location }: SiteLocationFactsProps) {
  const { t } = useTranslation();
  const presenter = useLocationPresenter(location);
  return <FactList title={t('site.location')} facts={presenter.facts()} />;
}
