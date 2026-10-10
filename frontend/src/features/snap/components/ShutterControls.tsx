import { useTranslation } from 'react-i18next';
import { AppSettingsButton } from '../../../ui/AppSettingsButton';
import { useInAppKey } from '../../../ui/useNativeBridge';
import type { GpsState } from '../hooks/useGpsFix';

interface ShutterControlsProps {
  readonly ready: boolean;
  readonly gps: GpsState;
  readonly onShoot: () => void;
}

/** The shutter waits for a live camera and a GPS fix, because the fix is frozen with the photo. */
export function ShutterControls({ ready, gps, onShoot }: ShutterControlsProps) {
  const { t } = useTranslation();
  const needed = useInAppKey('snap.gpsNeeded', 'snap.gpsNeededApp');
  const denied = gps.problem === 'denied';
  return (
    <div className="snap-camera__controls">
      <button type="button" className="shutter" aria-label={t('snap.shutter')} disabled={!ready || !gps.fix} onClick={onShoot} />
      {!gps.fix && <p className="form__note">{t(denied ? needed : 'snap.waitingForGps')}</p>}
      {!gps.fix && denied && <AppSettingsButton />}
    </div>
  );
}
