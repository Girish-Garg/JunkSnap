import { useEffect, useRef, useState, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import { CaptureError, type CaptureProblem } from '../../../domain/CaptureError';
import type { FirstFix } from '../../../services/ScanCapture';
import type { ScanDraft } from '../../../domain/ScanUpload';
import type { ActiveScan } from '../../../services/ScanCapture';
import type { ScanHintLog } from '../../../services/ScanHintLog';

export type RecorderPhase = 'idle' | 'recording' | 'saving';

// stop(CUT): the camera froze under the recording (LiveCamera). The stop button passes its click event instead.
const CUT = Symbol('camera stopped');

export interface RecorderEvents {
  /** The queued scan's id, and whether the camera froze and cut the recording short (cut stops it then). */
  readonly onSaved: (id: string, cameraStopped: boolean) => void;
  /** True from Start until the clip is saved or dropped: the Photo and No bin switch waits meanwhile. */
  readonly onBusy?: (busy: boolean) => void;
}

// The phase, told to onBusy too: busy from Start until the clip is saved or dropped.
function usePhase(onBusy: RecorderEvents['onBusy']) {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const enter = (next: RecorderPhase) => {
    setPhase(next);
    onBusy?.(next !== 'idle');
  };
  return [phase, enter] as const;
}

// The current recording. Unmount (sheet closed, Android back) cancels it while it still runs; a stopped one keeps saving.
function useActiveScan() {
  const [active, setActive] = useState<ActiveScan | null>(null);
  useEffect(() => () => active?.cancel(), [active]);
  return [active, setActive] as const;
}

/** Starts and stops one Scan recording on the viewfinder stream. Leaving the stage mid-recording abandons the clip. */
export function useScanRecorder(video: RefObject<HTMLVideoElement | null>, { onSaved, onBusy }: RecorderEvents) {
  const { snap } = useServices();
  const [phase, enter] = usePhase(onBusy);
  const [active, setActive] = useActiveScan();
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
      enter('recording');
      run.saved.then((scan) => scan && onSaved(scan.id, cameraStopped.current), fail).finally(() => enter('idle'));
    } catch (error) {
      fail(error);
    }
  };
  const stop = (reason?: unknown) => {
    cameraStopped.current = reason === CUT;
    active?.stop();
    enter('saving');
  };
  return { phase, elapsedMs, problem, start, stop, cut: () => stop(CUT), supported: snap.recorder.isSupported() };
}
