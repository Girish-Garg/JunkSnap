import { useTranslation } from 'react-i18next';
import { useInAppKey } from '../../../ui/useNativeBridge';
import { GpsView } from '../GpsView';
import type { GpsState } from '../hooks/useGpsFix';
import { GpsChip } from './GpsChip';

/** The live fix that goes with the report, and what to do when it is weak or missing. */
export function GpsPanel({ gps }: { readonly gps: GpsState }) {
  const { t } = useTranslation();
  const view = GpsView.of(gps);
  const needed = useInAppKey('snap.gpsNeeded', 'snap.gpsNeededApp');
  const advice = gps.problem === 'denied' && !gps.fix ? needed : view.tone === 'alert' ? 'snap.gpsWeak' : null;
  return (
    <div className="gps-panel">
      <GpsChip gps={gps} />
      {advice && <p className="form__note">{t(advice)}</p>}
    </div>
  );
}
