import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import { CaptureError, type CaptureProblem } from '../../../domain/CaptureError';
import type { GpsFix } from '../../../domain/ReportUpload';
import { isoSeconds } from '../../../domain/utils';

export interface CapturedPhoto {
  readonly bytes: ArrayBuffer;
  readonly sha256: string;
  /** Shutter time and the GPS fix at that moment; both stay as they were when the photo was taken. */
  readonly capturedAt: string;
  readonly gps: GpsFix;
}

/** Turns a viewfinder frame into a hashed JPEG with its time and place frozen at the shutter. */
export function usePhotoCapture(onCaptured: (photo: CapturedPhoto) => void) {
  const { snap } = useServices();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<CaptureProblem | null>(null);
  const capture = async (video: HTMLVideoElement, gps: GpsFix) => {
    const capturedAt = isoSeconds(new Date());
    setBusy(true);
    setProblem(null);
    try {
      const bytes = await snap.encoder.fromVideo(video);
      onCaptured({ bytes, sha256: await snap.hasher.sha256(bytes), capturedAt, gps });
    } catch (error) {
      setProblem(error instanceof CaptureError ? error.problem : 'encode_failed');
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, fromVideo: (video: HTMLVideoElement, gps: GpsFix) => void capture(video, gps) };
}
