import { useRef, type RefObject } from 'react';
import { CAPTURE_GATES } from '../../../domain/CaptureGates';
import { EDGE_MODEL } from '../../../domain/EdgeModel';
import type { CaptureProblem } from '../../../domain/CaptureError';
import { ScanHintLog } from '../../../services/ScanHintLog';
import { useInAppKey } from '../../../ui/useNativeBridge';
import { useCamera, type CameraState } from './useCamera';
import { useEdgeHints } from './useEdgeHints';
import type { GpsState } from './useGpsFix';
import { useScanChoice } from './useScanChoice';
import { useScanRecorder } from './useScanRecorder';
import type { SnapFlow } from './useSnapFlow';

function cameraProblem(state: CameraState): CaptureProblem | null {
  return state === 'live' || state === 'starting' ? null : state;
}

/** Everything the video stage shows: camera, choice (Auto unless changed), recorder, and whether recording may start. */
export function useScanStage(video: RefObject<HTMLVideoElement | null>, flow: SnapFlow, gps: GpsState) {
  const recorder = useScanRecorder(video, flow.scanSaved);
  // A camera that freezes mid-recording ends the recording with the clip so far. It reopens only
  // once the clip is saved (phase back to idle), never while the recording is being finished.
  const camera = useCamera(video, 'video', { holding: () => recorder.phase !== 'idle', onLost: recorder.cut });
  const report = useScanChoice();
  // Edge mode only: the strongest waste box of each analysed frame goes with the scan as a hint.
  const hintLog = useRef<ScanHintLog | null>(null);
  const hints = useEdgeHints(video, camera.state === 'live', (frame) => hintLog.current?.add(frame));
  const choice = report.choice;
  const gpsNeededReason = useInAppKey('snap.gpsNeeded', 'snap.gpsNeededApp');
  const canStart = CAPTURE_GATES.record.decide({
    camera: camera.state,
    fix: gps.fix,
    gpsDenied: gps.problem === 'denied',
    gpsNeededReason,
    recorderSupported: recorder.supported,
    chosen: choice !== null,
  });
  const start = () => {
    if (!choice || !gps.fix) return;
    hintLog.current = hints.state === 'live' ? new ScanHintLog(EDGE_MODEL.version) : null;
    recorder.start(choice, { fix: gps.fix, takenAtMs: gps.takenAtMs }, hintLog.current);
  };
  const problem: CaptureProblem | null = recorder.problem ?? (recorder.supported ? null : 'recorder_unsupported');
  return { camera, report, recorder, hints, failed: cameraProblem(camera.state), canStart, start, problem };
}
