import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import { AppSettingsButton } from '../../../ui/AppSettingsButton';
import '../../../ui/blocked.css';
import type { GpsState } from '../hooks/useGpsFix';
import { useShutterGate } from '../hooks/useShutterGate';

interface ShutterControlsProps {
  /** The camera is live and not saving a photo. */
  readonly ready: boolean;
  readonly gps: GpsState;
  readonly onShoot: () => void;
}

/**
 * The shutter waits for a live camera and a GPS fix, because the fix is frozen with the photo. With location
 * blocked it looks off and a tap says how to allow it.
 */
export function ShutterControls({ ready, gps, onShoot }: ShutterControlsProps) {
  const { t } = useTranslation();
  const { shutter, gpsNeeded } = useShutterGate(ready, gps);
  const denied = gps.problem === 'denied';
  const look = lookOf(shutter.availability);
  return (
    <div className="snap-camera__controls">
      <button type="button" className="shutter" aria-label={t('snap.shutter')} disabled={look.disabled} aria-disabled={look.blocked || undefined} onClick={shutter.tap(onShoot)} />
      {!gps.fix && <p className="form__note">{t(denied ? gpsNeeded : 'snap.waitingForGps')}</p>}
      {!gps.fix && denied && <AppSettingsButton />}
    </div>
  );
}
