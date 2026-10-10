import { useTranslation } from 'react-i18next';
import '../boundaries.css';
import { MarkerKey } from './MarkerKey';

/** One line on what the fill means (never a withheld score), and the two marker glyphs in words. */
export function BoundaryLegend() {
  const { t } = useTranslation();
  return (
    <section className="boundary-legend" aria-label={t('boundaries.legend')}>
      <p>{t('boundaries.areasLine')}</p>
      <MarkerKey />
    </section>
  );
}
