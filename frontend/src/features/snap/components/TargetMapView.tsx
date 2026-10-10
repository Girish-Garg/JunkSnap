import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapSupport } from '../../map/MapSupport';
import { useTargetMap, type TargetMapState } from '../hooks/useTargetMap';

/** The small map of the place step. Without WebGL2 it says the report uses where the reporter stands. */
export function TargetMapView(view: TargetMapState) {
  const { t } = useTranslation();
  const [supported] = useState(() => MapSupport.hasWebGl2());
  const [failed, setFailed] = useState(false);
  const container = useTargetMap(supported && !failed, view, () => setFailed(true));
  if (!supported || failed) return <p className="form__note">{t('longRange.noMap')}</p>;
  return <div ref={container} className="target-map" data-own-drag="" role="application" aria-label={t('longRange.mapLabel')} />;
}
