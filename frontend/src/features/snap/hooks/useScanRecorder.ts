import { useRef, useState, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import { CaptureError, type CaptureProblem } from '../../../domain/CaptureError';
import type { FirstFix } from '../../../services/ScanCapture';
import type { ScanDraft } from '../../../domain/ScanUpload';
import type { ActiveScan } from '../../../services/ScanCapture';
import type { ScanHintLog } from '../../../services/ScanHintLog';

export type RecorderPhase = 'idle' | 'recording' | 'saving';

// stop(CUT): the camera froze under the recording (LiveCamera). The stop button passes its click event instead.
const CUT = Symbol('camera stopped');

/**
 * Starts and stops one Scan recording on the viewfinder stream; onSaved gets the queued scan's id,
 * and whether the camera froze and cut the recording short (cut stops it then).
 */
export function useScanRecorder(video: RefObject<HTMLVideoElement | null>, onSaved: (id: string, cameraStopped: boolean) => void) {
  const { snap } = useServices();
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [active, setActive] = useState<ActiveScan | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [problem, setProblem] = useState<CaptureProblem | null>(null);
  const cameraStopped = useRef(false);
  const fail = (error: unknown) => setProblem(error instanceof CaptureError ? error.problem : 'encode_failed');
  const start = (choice: Pick<ScanDraft, 'report_type' | 'context'>, firstFix: FirstFix, hints: ScanHintLog | null = null) => {
    const stream = video.current?.srcObject as MediaStream | null | undefined;
    if (!stream) return;
    setProblem(null);
    setElapsedMs(0);
    cameraStopped.current = false;
    try {
      const run = snap.scanCapture.start({ stream, firstFix, choice, onTick: setElapsedMs, ...(hints ? { hints } : {}) });
      setActive(run);
      setPhase('recording');
      run.saved.then((scan) => onSaved(scan.id, cameraStopped.current), fail).finally(() => setPhase('idle'));
    } catch (error) {
      fail(error);
    }
  };
  const stop = (reason?: unknown) => {
    cameraStopped.current = reason === CUT;
    active?.stop();
    setPhase('saving');
  };
  return { phase, elapsedMs, problem, start, stop, cut: () => stop(CUT), supported: snap.recorder.isSupported() };
}
