import { useTranslation } from 'react-i18next';
import { lookOf } from '../../../domain/ActionAvailability';
import { CAPTURE_GATES } from '../../../domain/CaptureGates';
import { AppSettingsButton } from '../../../ui/AppSettingsButton';
import '../../../ui/blocked.css';
import { useInAppKey } from '../../../ui/useNativeBridge';
import { useGate } from '../../actions/hooks/useGate';
import type { GpsState } from '../hooks/useGpsFix';

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
  const gate = useGate();
  const needed = useInAppKey('snap.gpsNeeded', 'snap.gpsNeededApp');
  const denied = gps.problem === 'denied';
  const availability = CAPTURE_GATES.shutter.decide({ camera: ready ? 'live' : 'starting', fix: gps.fix, gpsDenied: denied, gpsNeededReason: needed });
  const look = lookOf(availability);
  return (
    <div className="snap-camera__controls">
      <button type="button" className="shutter" aria-label={t('snap.shutter')} disabled={look.disabled} aria-disabled={look.blocked || undefined} onClick={gate(availability, onShoot)} />
      {!gps.fix && <p className="form__note">{t(denied ? needed : 'snap.waitingForGps')}</p>}
      {!gps.fix && denied && <AppSettingsButton />}
    </div>
  );
}
