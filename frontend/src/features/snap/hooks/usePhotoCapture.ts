import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import { CaptureError, type CaptureProblem } from '../../../domain/CaptureError';
import { isoSeconds } from '../../../domain/utils';

export interface CapturedPhoto {
  readonly bytes: ArrayBuffer;
  readonly sha256: string;
  /** The shutter time, before encoding and hashing. */
  readonly capturedAt: string;
}

/** Turns a camera frame or a phone-camera file into a hashed JPEG. */
export function usePhotoCapture(onCaptured: (photo: CapturedPhoto) => void) {
  const { snap } = useServices();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<CaptureProblem | null>(null);
  const capture = async (encode: () => Promise<ArrayBuffer>) => {
    const capturedAt = isoSeconds(new Date());
    setBusy(true);
    setProblem(null);
    try {
      const bytes = await encode();
      onCaptured({ bytes, sha256: await snap.hasher.sha256(bytes), capturedAt });
    } catch (error) {
      setProblem(error instanceof CaptureError ? error.problem : 'encode_failed');
    } finally {
      setBusy(false);
    }
  };
  return {
    busy,
    problem,
    fromVideo: (video: HTMLVideoElement) => void capture(() => snap.encoder.fromVideo(video)),
    fromFile: (file: Blob) => void capture(() => snap.encoder.fromFile(file)),
  };
}
