import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_QUERY, useMediaQuery } from '../../../ui/useMediaQuery';

/**
 * The map legend behind a small "Legend" chip, so on phones it never covers the pins; it starts open on desktop,
 * where the map has room. The honesty line (scores need 10 verified reports) stays visible beside the chip.
 * The legend itself (BoundaryLegend) is unchanged.
 */
export function LegendToggle({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [choice, setChoice] = useState<boolean | null>(null);
  const open = choice ?? desktop;
  return (
    <div className={open ? 'legend-toggle legend-toggle--open' : 'legend-toggle'}>
      <div className="legend-toggle__row">
        <button type="button" className="pill legend-toggle__chip" aria-expanded={open} onClick={() => setChoice(!open)}>
          {t('boundaries.legendChip')}
        </button>
        <p className="legend-toggle__caveat">{t('boundaries.caveat')}</p>
      </div>
      {open && children}
    </div>
  );
}
