import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CameraHelp } from '../../snap/components/CameraHelp';
import { GpsChip } from '../../snap/components/GpsChip';
import { ShutterControls } from '../../snap/components/ShutterControls';
import { useCamera } from '../../snap/hooks/useCamera';
import type { GpsState } from '../../snap/hooks/useGpsFix';
import type { CleanupFlow } from '../hooks/useCleanup';

interface CleanupCameraProps {
  readonly flow: CleanupFlow;
  readonly gps: GpsState;
}

/** The same in-app camera as Snap: no gallery, GPS frozen at the shutter. */
export function CleanupCamera({ flow, gps }: CleanupCameraProps) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const camera = useCamera(video);
  const failed = camera.state === 'live' || camera.state === 'starting' ? null : camera.state;
  const shoot = () => {
    if (video.current && gps.fix) flow.capture.fromVideo(video.current, gps.fix);
  };
  return (
    <div className="snap-camera">
      <div className="viewfinder viewfinder--video">
        <video ref={video} className="viewfinder__video" playsInline muted aria-hidden="true" />
        <GpsChip gps={gps} />
      </div>
      {failed ? (
        <CameraHelp problem={failed} onRetry={camera.retry} />
      ) : (
        <ShutterControls ready={camera.state === 'live' && !flow.capture.busy} gps={gps} onShoot={shoot} />
      )}
      {flow.capture.problem && (
        <p className="form__error" role="alert">
          {t(`snap.${flow.capture.problem}`)}
        </p>
      )}
    </div>
  );
}
