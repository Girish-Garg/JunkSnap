import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { GpsState } from '../hooks/useGpsFix';
import { useScanStage } from '../hooks/useScanStage';
import type { SnapFlow } from '../hooks/useSnapFlow';
import { CameraHelp } from './CameraHelp';
import { EdgeOverlay } from './EdgeOverlay';
import { GpsChip } from './GpsChip';
import { RecordControls } from './RecordControls';
import { ScanPlacePicker } from './ScanPlacePicker';
import { ScanTypePicker } from './ScanTypePicker';

interface ScanStageProps {
  readonly flow: SnapFlow;
  readonly gps: GpsState;
}

/** Video: record up to a minute as an area scout, or narrow the type and place first; the server checks every frame. */
export function ScanStage({ flow, gps }: ScanStageProps) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const stage = useScanStage(video, flow, gps);
  const { recorder, report } = stage;
  const idle = recorder.phase === 'idle';
  return (
    <div className="snap-camera">
      <div className="viewfinder viewfinder--video">
        <video ref={video} className="viewfinder__video" playsInline muted aria-hidden="true" />
        <EdgeOverlay state={stage.hints.state} view={stage.hints.view} />
        <GpsChip gps={gps} />
      </div>
      {stage.failed ? (
        <CameraHelp problem={stage.failed} onRetry={stage.camera.retry} />
      ) : (
        <RecordControls phase={recorder.phase} elapsedMs={recorder.elapsedMs} canStart={stage.canStart} onStart={stage.start} onStop={recorder.stop} />
      )}
      {stage.problem && (
        <p className="form__error" role="alert">
          {t(`scan.${stage.problem}`)}
        </p>
      )}
      {idle && <p className="form__note">{t(gps.fix ? 'scan.pickFirst' : 'snap.waitingForGps')}</p>}
      {idle && <ScanTypePicker value={report.type} onChange={report.chooseType} />}
      {idle && <ScanPlacePicker options={report.places} value={report.place} onChange={report.setPlace} />}
    </div>
  );
}
