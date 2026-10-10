import { useTranslation } from 'react-i18next';
import '../boundaries.css';
import { MarkerKey } from './MarkerKey';

/** One line on what the fill means (never a withheld score), the two marker glyphs, and dashed outlines. */
export function BoundaryLegend() {
  const { t } = useTranslation();
  return (
    <section className="boundary-legend" aria-label={t('boundaries.legend')}>
      <p>{t('boundaries.areasLine')}</p>
      <MarkerKey />
      <div className="boundary-legend__ramp">
        <span className="boundary-legend__dash" aria-hidden="true" />
        <span>{t('boundaries.outdated')}</span>
      </div>
    </section>
  );
}
