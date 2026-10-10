import { useTranslation } from 'react-i18next';
import '../boundaries.css';
import type { LegendEntries } from '../LegendKeys';
import { MarkerKey } from './MarkerKey';
import { PinKey } from './PinKey';
import { TintKey } from './TintKey';

/**
 * The pins, then only the area entries the map shows now: the neighbour tints and the focus outline once areas
 * are drawn, the score colour once some seat has a score, the markers once seats have verified reports (with
 * the score, its count and the pilot flag once some seat has a score), and the dashed outline.
 */
export function BoundaryLegend({ keys }: { readonly keys: LegendEntries }) {
  const { t } = useTranslation();
  const markers = keys.counts || keys.scores;
  return (
    <section className="boundary-legend" aria-label={t('boundaries.legend')}>
      <PinKey />
      {keys.boundaries && <TintKey />}
      {keys.scores && <p className="boundary-legend__line">{t('boundaries.areasLine')}</p>}
      {markers && <MarkerKey scores={keys.scores} />}
      {keys.boundaries && (
        <div className="boundary-legend__ramp">
          <span className="boundary-legend__dash" aria-hidden="true" />
          <span>{t('boundaries.outdated')}</span>
        </div>
      )}
    </section>
  );
}
