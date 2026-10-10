import { useTranslation } from 'react-i18next';
import type { GpsState } from '../hooks/useGpsFix';

interface ShutterControlsProps {
  readonly ready: boolean;
  readonly gps: GpsState;
  readonly onShoot: () => void;
}

/** The shutter waits for a live camera and a GPS fix, because the fix is frozen with the photo. */
export function ShutterControls({ ready, gps, onShoot }: ShutterControlsProps) {
  const { t } = useTranslation();
  const waiting = gps.problem === 'denied' ? 'snap.gpsNeeded' : 'snap.waitingForGps';
  return (
    <div className="snap-camera__controls">
      <button type="button" className="shutter" aria-label={t('snap.shutter')} disabled={!ready || !gps.fix} onClick={onShoot} />
      {!gps.fix && <p className="form__note">{t(waiting)}</p>}
    </div>
  );
}
