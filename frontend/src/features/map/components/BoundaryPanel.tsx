import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { RANKING_PATH } from '../../../app/paths';
import { BOUNDARY_KINDS, type BoundaryKind } from '../../../domain/AreaListing';
import { Segmented, type SegmentOption } from '../../../ui/Segmented';
import type { BoundaryLayerState } from '../hooks/useBoundaryLayer';

interface BoundaryPanelProps {
  readonly boundary: BoundaryLayerState;
}

const OFF = 'off';
type Choice = BoundaryKind | typeof OFF;

/** Wards, assembly seats, Lok Sabha seats or none (only kinds with a boundary file), and the city ranking. */
export function BoundaryPanel({ boundary }: BoundaryPanelProps) {
  const { t } = useTranslation();
  const kinds = BOUNDARY_KINDS.filter((kind) => boundary.available.includes(kind));
  const options: SegmentOption<Choice>[] = [
    ...kinds.map((kind) => ({ value: kind, label: t(`boundaries.layer.${kind}`) })),
    { value: OFF, label: t('boundaries.off') },
  ];
  return (
    <div className="boundary-switcher__panel" role="group" aria-label={t('boundaries.title')}>
      <p className="boundary-switcher__title">{t('boundaries.title')}</p>
      <Segmented
        label={t('ranking.kindLabel')}
        options={options}
        value={boundary.kind ?? OFF}
        onChange={(value) => boundary.choose(value === OFF ? null : value)}
      />
      {!kinds.includes('ward') && <p className="boundary-switcher__note">{t('boundaries.noWards')}</p>}
      <Link className="boundary-switcher__link" to={RANKING_PATH}>
        {t('ranking.open')}
      </Link>
    </div>
  );
}
