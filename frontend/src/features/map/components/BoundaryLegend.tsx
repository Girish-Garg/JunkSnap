import { useTranslation } from 'react-i18next';
import '../boundaries.css';
import type { LegendEntries } from '../LegendKeys';
import { MarkerKey } from './MarkerKey';
import { PinKey } from './PinKey';

/**
 * The pins, then only the area entries the map shows now: the fill and the markers once seats have verified
 * reports, the score, its count and the pilot flag once some seat has a score, and the dashed outline.
 */
export function BoundaryLegend({ keys }: { readonly keys: LegendEntries }) {
  const { t } = useTranslation();
  const areas = keys.counts || keys.scores;
  return (
    <section className="boundary-legend" aria-label={t('boundaries.legend')}>
      <PinKey />
      {areas && <p className="boundary-legend__line">{t(keys.scores ? 'boundaries.areasLine' : 'boundaries.countLine')}</p>}
      {areas && <MarkerKey scores={keys.scores} />}
      {keys.boundaries && (
        <div className="boundary-legend__ramp">
          <span className="boundary-legend__dash" aria-hidden="true" />
          <span>{t('boundaries.outdated')}</span>
        </div>
      )}
    </section>
  );
}
