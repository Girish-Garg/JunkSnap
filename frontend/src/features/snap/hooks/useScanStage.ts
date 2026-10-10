import type { RefObject } from 'react';
import type { CaptureProblem } from '../../../domain/CaptureError';
import { useCamera, type CameraState } from './useCamera';
import type { GpsState } from './useGpsFix';
import { useReportChoice } from './useReportChoice';
import { useScanRecorder } from './useScanRecorder';
import type { SnapFlow } from './useSnapFlow';

function cameraProblem(state: CameraState): CaptureProblem | null {
  return state === 'live' || state === 'starting' ? null : state;
}

/** Everything the video stage shows: camera, choice, recorder, and whether recording may start. */
export function useScanStage(video: RefObject<HTMLVideoElement | null>, flow: SnapFlow, gps: GpsState) {
  const camera = useCamera(video, 'video');
  const report = useReportChoice();
  const recorder = useScanRecorder(video, flow.scanSaved);
  const choice = report.choice;
  const canStart = camera.state === 'live' && recorder.supported && gps.fix !== null && choice !== null;
  const start = () => {
    if (!choice || !gps.fix) return;
    recorder.start({ report_type: choice.report_type, context: choice.context }, { fix: gps.fix, takenAtMs: gps.takenAtMs });
  };
  const problem: CaptureProblem | null = recorder.problem ?? (recorder.supported ? null : 'recorder_unsupported');
  return { camera, report, recorder, failed: cameraProblem(camera.state), canStart, start, problem };
}
