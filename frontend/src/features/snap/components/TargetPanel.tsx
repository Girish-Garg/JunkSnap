import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GeoBearing } from '../../../domain/GeoBearing';
import { HIGH_CAP_M } from '../../../domain/TargetPlacement';
import { Checkbox } from '../../../ui/Checkbox';
import { useCompassHeading } from '../hooks/useCompassHeading';
import type { TargetPlace } from '../hooks/useTargetPlacement';
import { TargetMapView } from './TargetMapView';

/** "Farther away": the map with the pin, how far it is, why it stopped at the cap, and the rooftop reach. */
export function TargetPanel({ place }: { readonly place: TargetPlace }) {
  const { t } = useTranslation();
  const { placement } = place;
  const heading = useCompassHeading(true);
  const { origin, capM } = placement;
  const headingEnd = useMemo(() => (heading === null ? null : GeoBearing.offset(origin, heading, capM)), [heading, origin, capM]);
  const distance = placement.target ? t('longRange.distance', { metres: placement.shownM }) : t('longRange.atYou');
  const capNote = placement.high ? 'longRange.cappedHigh' : 'longRange.capped';
  return (
    <div className="place-target">
      <TargetMapView origin={origin} spot={placement.spot} headingEnd={headingEnd} onMove={place.moveTo} />
      <p className="place-target__distance" aria-live="polite">
        {distance}
      </p>
      {placement.capped && (
        <p className="place-target__cap" role="status">
          {t(capNote, { metres: capM, high: HIGH_CAP_M })}
        </p>
      )}
      {heading !== null && <p className="field__hint">{t('longRange.heading')}</p>}
      <Checkbox id="place-high" label={t('longRange.high', { metres: HIGH_CAP_M })} checked={placement.high} onChange={place.setHigh} />
    </div>
  );
}
