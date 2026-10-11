import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { SiteStatusChip } from '../../../domain/SiteStatusChip';
import { ExplainButton } from './ExplainButton';

interface StatusChipButtonProps {
  readonly site: SiteProperties;
}

/** The status chip on the pin card and the site sheet; a tap says what the status means (the lists keep StatusChip). */
export function StatusChipButton({ site }: StatusChipButtonProps) {
  const { t } = useTranslation();
  const chip = SiteStatusChip.of(site);
  return (
    <ExplainButton site={site} chip={chip} className={`status-chip status-chip--${chip.tone}`}>
      {t(chip.key, chip.params)}
    </ExplainButton>
  );
}
