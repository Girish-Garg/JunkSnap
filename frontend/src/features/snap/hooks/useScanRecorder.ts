import { useState, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import { CaptureError, type CaptureProblem } from '../../../domain/CaptureError';
import type { FirstFix } from '../../../services/ScanCapture';
import type { ScanDraft } from '../../../domain/ScanUpload';
import type { ActiveScan } from '../../../services/ScanCapture';

export type RecorderPhase = 'idle' | 'recording' | 'saving';

/** Starts and stops one Scan recording on the viewfinder stream; onSaved gets the queued scan's id. */
export function useScanRecorder(video: RefObject<HTMLVideoElement | null>, onSaved: (id: string) => void) {
  const { snap } = useServices();
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [active, setActive] = useState<ActiveScan | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [problem, setProblem] = useState<CaptureProblem | null>(null);
  const fail = (error: unknown) => setProblem(error instanceof CaptureError ? error.problem : 'encode_failed');
  const start = (choice: Pick<ScanDraft, 'report_type' | 'context'>, firstFix: FirstFix) => {
    const stream = video.current?.srcObject as MediaStream | null | undefined;
    if (!stream) return;
    setProblem(null);
    setElapsedMs(0);
    try {
      const run = snap.scanCapture.start({ stream, firstFix, choice, onTick: setElapsedMs });
      setActive(run);
      setPhase('recording');
      run.saved.then((scan) => onSaved(scan.id), fail).finally(() => setPhase('idle'));
    } catch (error) {
      fail(error);
    }
  };
  const stop = () => {
    active?.stop();
    setPhase('saving');
  };
  return { phase, elapsedMs, problem, start, stop, supported: snap.recorder.isSupported() };
}
