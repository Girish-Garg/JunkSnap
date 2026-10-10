import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { SiteStatusChip } from '../../../domain/SiteStatusChip';

interface StatusChipProps {
  readonly site: Pick<SiteProperties, 'status' | 'verification' | 'backers'>;
}

/** A dot and the words, on a tint: "Waiting · 1 of 10", "Verified", "Cleared". Never red for a normal state. */
export function StatusChip({ site }: StatusChipProps) {
  const { t } = useTranslation();
  const chip = SiteStatusChip.of(site);
  return <span className={`status-chip status-chip--${chip.tone}`}>{t(chip.key, chip.params)}</span>;
}
