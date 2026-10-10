import { useTranslation } from 'react-i18next';
import { TINT_COUNT } from '../../../layers/boundaries/AreaTints';

const SLOTS = Array.from({ length: TINT_COUNT }, (_, slot) => slot + 1);

/** The neighbour tints in the legend, then the thick focus outline: what the area colours and lines mean. */
export function TintKey() {
  const { t } = useTranslation();
  return (
    <>
      <div className="boundary-legend__ramp">
        <span className="tint-key" aria-hidden="true">
          {SLOTS.map((slot) => (
            <span key={slot} className={`tint-key__swatch tint-key__swatch--${String(slot)}`} />
          ))}
        </span>
        <span>{t('boundaries.tintLine')}</span>
      </div>
      <div className="boundary-legend__ramp">
        <span className="tint-key__focus" aria-hidden="true" />
        <span>{t('boundaries.focusLine')}</span>
      </div>
    </>
  );
}
