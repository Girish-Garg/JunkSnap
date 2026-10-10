import { useTranslation } from 'react-i18next';
import { SiteStatusChip, type ChipFields } from '../../../domain/SiteStatusChip';

interface StatusChipProps {
  readonly site: ChipFields;
}

/** A dot and the words, on a tint: "Waiting · 1 of 10", "Verified", "Cleared". Never red for a normal state. */
export function StatusChip({ site }: StatusChipProps) {
  const { t } = useTranslation();
  const chip = SiteStatusChip.of(site);
  return <span className={`status-chip status-chip--${chip.tone}`}>{t(chip.key, chip.params)}</span>;
}
