import { useTranslation } from 'react-i18next';
import type { SiteProperties } from '../../../domain/Site';
import { SiteChip } from '../../../domain/SiteChip';

const KEYS = { waiting: 'browse.chipWaiting', verified: 'browse.chipVerified', cleared: 'browse.chipCleared' } as const;

/** "Waiting · 3 of 10", "Verified" or "Cleared · 1 of 3": a dot plus the words, so colour is never the only cue. */
export function SiteChipBadge({ site }: { readonly site: SiteProperties }) {
  const { t } = useTranslation();
  const chip = SiteChip.of(site);
  return <span className={`badge chip-badge chip-badge--${chip.kind}`}>{t(KEYS[chip.kind], { count: chip.count, needed: chip.needed })}</span>;
}
