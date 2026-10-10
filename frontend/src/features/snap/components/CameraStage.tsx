import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCamera, type CameraState } from '../hooks/useCamera';
import { useEdgeHints } from '../hooks/useEdgeHints';
import type { GpsState } from '../hooks/useGpsFix';
import type { SnapFlow } from '../hooks/useSnapFlow';
import { CameraHelp } from './CameraHelp';
import { EdgeOverlay } from './EdgeOverlay';
import { GpsChip } from './GpsChip';
import { ShutterControls } from './ShutterControls';
import { SnapFooter } from './SnapFooter';

interface CameraStageProps {
  readonly flow: SnapFlow;
  readonly gps: GpsState;
}

// The line over the viewfinder: saving, a capture problem, or why the camera is not live.
function viewfinderMessage(camera: CameraState, capture: SnapFlow['capture']): string | null {
  if (capture.busy) return 'snap.saving';
  if (capture.problem) return `snap.${capture.problem}`;
  return camera === 'live' ? null : `snap.${camera}`;
}

export function CameraStage({ flow, gps }: CameraStageProps) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const camera = useCamera(video);
  const { capture } = flow;
  const hints = useEdgeHints(video, camera.state === 'live' && !capture.busy);
  const message = viewfinderMessage(camera.state, capture);
  const failed = camera.state === 'live' || camera.state === 'starting' ? null : camera.state;
  const shoot = () => video.current && gps.fix && capture.fromVideo(video.current, gps.fix);
  return (
    <div className="snap-camera">
      <div className="viewfinder">
        <video ref={video} className="viewfinder__video" playsInline muted aria-hidden="true" />
        <EdgeOverlay state={hints.state} view={hints.view} />
        {message && (
          <p className="viewfinder__message" role="status">
            {t(message)}
          </p>
        )}
        <GpsChip gps={gps} />
      </div>
      {failed ? (
        <CameraHelp problem={failed} onRetry={camera.retry} />
      ) : (
        <ShutterControls ready={camera.state === 'live' && !capture.busy} gps={gps} onShoot={shoot} />
      )}
      <SnapFooter />
    </div>
  );
}
