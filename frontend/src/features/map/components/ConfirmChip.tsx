import { useTranslation } from 'react-i18next';
import type { SiteFeature } from '../../../domain/Site';
import { SiteOrder, type SiteSort } from '../../../domain/SiteOrder';

interface ConfirmChipProps {
  readonly sites: readonly SiteFeature[];
  readonly sort: SiteSort;
  /** null goes back to the default order. */
  readonly onSort: (sort: SiteSort | null) => void;
}

/** "Needs confirming": the sites still waiting for people come first, nearest first, so neighbours can back them. */
export function ConfirmChip({ sites, sort, onSort }: ConfirmChipProps) {
  const { t } = useTranslation();
  const on = sort === 'confirm';
  const waiting = sites.filter(SiteOrder.waiting).length;
  if (waiting === 0 && !on) return null;
  return (
    <button type="button" className="pill confirm-chip" aria-pressed={on} onClick={() => onSort(on ? null : 'confirm')}>
      {t('browse.confirm')} <span className="num">{waiting}</span>
    </button>
  );
}
