import { useTranslation } from 'react-i18next';
import '../boundaries.css';
import type { BoundaryKind } from '../../../domain/AreaListing';
import { useFormatter } from '../../../i18n/useFormatter';
import type { WardCoverage } from '../../../services/BoundaryCatalog';
import { ChoroplethScale } from '../ChoroplethScale';
import { WardCoverageText } from '../WardCoverageText';
import { LegendRamp } from './LegendRamp';

interface BoundaryLegendProps {
  readonly kind: BoundaryKind | null;
  readonly wardCoverage: readonly WardCoverage[];
}

/** Says what the fill means: the mean score where one shows, else verified reports; never a withheld score. */
export function BoundaryLegend({ kind, wardCoverage }: BoundaryLegendProps) {
  const { t } = useTranslation();
  const format = useFormatter();
  if (!kind) return null;
  return (
    <section className="boundary-legend" aria-label={t('boundaries.legend')}>
      <p className="boundary-legend__title">{t(`areas.kinds.${kind}`)}</p>
      {kind === 'ward' && (
        <p className="boundary-legend__caveat">
          {WardCoverageText.of(wardCoverage, (key, params) => t(key, params), (n) => format.number(n))}
        </p>
      )}
      <LegendRamp steps={ChoroplethScale.scoreSteps} label={t('boundaries.byScore')} />
      <LegendRamp steps={ChoroplethScale.countSteps} label={t('boundaries.byCount')} />
      <p>{t('boundaries.scoreRule')}</p>
      {kind === 'loksabha' && (
        <div className="boundary-legend__ramp">
          <span className="boundary-legend__dash" aria-hidden="true" />
          <span>{t('boundaries.outdated')}</span>
        </div>
      )}
    </section>
  );
}
